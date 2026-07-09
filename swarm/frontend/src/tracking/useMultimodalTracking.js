// Client-side multimodal tracking — MediaPipe Pose + Face Mesh, in-browser only.
// Raw video NEVER leaves the device and is never stored: each sampled frame is
// reduced to three numbers ({ timestamp, signal_type, value }) and discarded.
// Tracking is silent — no live feedback of any kind is surfaced during a session.
import { useRef, useState, useCallback } from "react";
import { FilesetResolver, FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const SAMPLE_INTERVAL_MS = 250; // trend tracking — full framerate is unnecessary

const deg = (rad) => (rad * 180) / Math.PI;

// Pose landmark indices
const L_SHOULDER = 11, R_SHOULDER = 12;
// Face mesh landmark indices
const R_EYE_OUTER = 33, L_EYE_OUTER = 263;
const LIP_UPPER = 13, LIP_LOWER = 14, FOREHEAD = 10, CHIN = 152;

export function useMultimodalTracking() {
  // idle | starting | active | denied | unavailable | stopped
  const [status, setStatus] = useState("idle");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const poseRef = useRef(null);
  const faceRef = useRef(null);
  const intervalRef = useRef(null);
  const signalsRef = useRef([]);
  const lastVideoTimeRef = useRef(-1);

  const sampleFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    // Skip if no new frame since last sample
    if (video.currentTime === lastVideoTimeRef.current) return;
    lastVideoTimeRef.current = video.currentTime;

    const now = Date.now();
    const ts = performance.now();

    try {
      // Posture — shoulder-line alignment (degrees off horizontal)
      const pose = poseRef.current?.detectForVideo(video, ts);
      const pl = pose?.landmarks?.[0];
      if (pl?.[L_SHOULDER] && pl?.[R_SHOULDER]) {
        const dx = pl[L_SHOULDER].x - pl[R_SHOULDER].x;
        const dy = pl[L_SHOULDER].y - pl[R_SHOULDER].y;
        signalsRef.current.push({ timestamp: now, signal_type: "posture", value: Math.abs(deg(Math.atan2(dy, dx))) });
      }
    } catch { /* pose detection hiccup — skip this sample */ }

    try {
      const face = faceRef.current?.detectForVideo(video, ts);
      const fl = face?.faceLandmarks?.[0];
      if (fl?.[R_EYE_OUTER] && fl?.[L_EYE_OUTER]) {
        // Head tilt — roll angle of the eye line, degrees
        const dx = fl[L_EYE_OUTER].x - fl[R_EYE_OUTER].x;
        const dy = fl[L_EYE_OUTER].y - fl[R_EYE_OUTER].y;
        signalsRef.current.push({ timestamp: now, signal_type: "head_tilt", value: deg(Math.atan2(dy, dx)) });
      }
      if (fl?.[LIP_UPPER] && fl?.[LIP_LOWER] && fl?.[FOREHEAD] && fl?.[CHIN]) {
        // Mouth movement — inner-lip gap normalized by face height
        const faceH = Math.hypot(fl[CHIN].x - fl[FOREHEAD].x, fl[CHIN].y - fl[FOREHEAD].y) || 1;
        const gap = Math.hypot(fl[LIP_LOWER].x - fl[LIP_UPPER].x, fl[LIP_LOWER].y - fl[LIP_UPPER].y);
        signalsRef.current.push({ timestamp: now, signal_type: "mouth_movement", value: gap / faceH });
      }
    } catch { /* face detection hiccup — skip this sample */ }
  }, []);

  /**
   * Request camera + load models. Call only after the user has explicitly
   * consented via the on-screen prompt. Returns true if tracking is running.
   */
  const enable = useCallback(async () => {
    if (status === "active" || status === "starting") return true;
    setStatus("starting");

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    } catch (e) {
      setStatus(e.name === "NotAllowedError" || e.name === "PermissionDeniedError" ? "denied" : "unavailable");
      return false;
    }

    try {
      // Hidden off-screen video element — never displayed, never recorded
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";
      document.body.appendChild(video);
      video.srcObject = stream;
      await video.play();

      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const [pose, face] = await Promise.all([
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        }),
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        }),
      ]);

      videoRef.current = video;
      streamRef.current = stream;
      poseRef.current = pose;
      faceRef.current = face;
      signalsRef.current = [];
      intervalRef.current = setInterval(sampleFrame, SAMPLE_INTERVAL_MS);
      setStatus("active");
      return true;
    } catch (e) {
      console.error("[tracking] model init failed — continuing voice-only:", e);
      stream.getTracks().forEach(t => t.stop());
      setStatus("unavailable");
      return false;
    }
  }, [status, sampleFrame]);

  /** Stop everything and return the collected derived signals. */
  const end = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    try { poseRef.current?.close(); } catch { /* already closed */ }
    try { faceRef.current?.close(); } catch { /* already closed */ }
    poseRef.current = null;
    faceRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }
    setStatus(s => (s === "active" || s === "starting" ? "stopped" : s));
    return signalsRef.current;
  }, []);

  return { status, enable, end, isTracking: status === "active" };
}
