import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { streamFetch } from "../lib/api";
import { speakText, stopAllAudio } from "../hooks/useVoiceOutput";
import { useElevenLabsSTT } from "../hooks/useElevenLabsSTT";
import { useMultimodalTracking } from "../tracking/useMultimodalTracking";
import PanelRail, { QuestionRail } from "./PanelRail";

const sv = {
  initial: { opacity: 0, filter: "blur(10px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, filter: "blur(8px)", transition: { duration: 0.35 } },
};

const WAVEFORM_BARS = 28;

/* Mic waveform — real frequency data while the user speaks */
function MicWaveform({ active, analyserRef }) {
  const barsRef = useRef(Array(WAVEFORM_BARS).fill(4));
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const barW = Math.floor(W / WAVEFORM_BARS) - 1;
    const dataArray = analyserRef?.current
      ? new Uint8Array(analyserRef.current.frequencyBinCount)
      : null;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      if (active && analyserRef?.current && dataArray) {
        analyserRef.current.getByteFrequencyData(dataArray);
        const step = Math.floor(dataArray.length / WAVEFORM_BARS);
        for (let i = 0; i < WAVEFORM_BARS; i++) {
          const raw = dataArray[i * step] / 255;
          barsRef.current[i] = barsRef.current[i] * 0.75 + raw * 0.25;
        }
      } else {
        for (let i = 0; i < WAVEFORM_BARS; i++) barsRef.current[i] *= 0.85;
      }
      barsRef.current.forEach((val, i) => {
        const barH = Math.max(2, val * (H - 4));
        ctx.fillStyle = "rgba(116,185,160,0.85)";
        ctx.beginPath();
        ctx.roundRect(i * (barW + 1), (H - barH) / 2, barW, barH, 2);
        ctx.fill();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [active, analyserRef]);

  return (
    <canvas ref={canvasRef} width={WAVEFORM_BARS * 7} height={30}
      style={{ display: "block", opacity: active ? 1 : 0.15, transition: "opacity 0.4s" }} />
  );
}

/* Self-view mirror — the user's own camera, visible only to them, never recorded */
function SelfView({ stream }) {
  const videoRef = useRef(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, hidden]);

  if (!stream) return null;

  if (hidden) {
    return (
      <button className="btn btn-ghost" onClick={() => setHidden(false)}
        style={{ position: "fixed", bottom: 26, left: 24, zIndex: 20, height: 32, fontSize: 11, padding: "0 12px" }}>
        Show my camera
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 26, left: 24, zIndex: 20,
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          width: 176, height: 132, objectFit: "cover",
          borderRadius: 12,
          border: "1px solid var(--line)",
          transform: "scaleX(-1)", /* mirror, like looking in a mirror */
          background: "var(--surface)",
          boxShadow: "0 8px 24px rgba(6,8,14,0.5)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--dim)", letterSpacing: "0.05em" }}>
          Your camera. Only you see this.
        </span>
        <button onClick={() => setHidden(true)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--mono)", fontSize: 9, color: "var(--dim)",
            textDecoration: "underline", padding: 0,
          }}>
          hide
        </button>
      </div>
    </div>
  );
}

const TIME_LIMIT = 60;

function CountdownRing({ seconds, total = TIME_LIMIT }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - seconds / total);
  const color = seconds > 15 ? "var(--calm)" : "var(--honey)";
  return (
    <div style={{ position: "relative", width: 42, height: 42, flexShrink: 0 }}>
      <svg width="42" height="42" style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--line)" strokeWidth="2.5" />
        <motion.circle cx="21" cy="21" r={r} fill="none"
          stroke={color} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: "linear" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color, lineHeight: 1 }}>{seconds}</span>
      </div>
    </div>
  );
}

export default function VoiceSession({ sessionData, situation, onEndSession, getIdToken, timedMode = false }) {
  const [history, setHistory] = useState([]);
  const [currentPersona, setCurrentPersona] = useState(null);
  const [displayLine, setDisplayLine] = useState("");
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [questionNum, setQuestionNum] = useState(0);

  const countdownRef = useRef(null);
  const transcriptRef = useRef(null);
  const currentAudio = useRef(null);
  const historyRef = useRef([]);
  const questionIndexRef = useRef(0);
  const isAISpeakingRef = useRef(false);
  const sessionCompleteRef = useRef(false);
  const isBusyRef = useRef(false);
  const hasInitRef = useRef(false);
  const sessionEndedRef = useRef(false);

  const [cameraNote, setCameraNote] = useState("");
  const tracking = useMultimodalTracking();
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;
  const signalDataRef = useRef(null);

  const personas = sessionData?.personas || [];
  const isConvo = sessionData?.mode === "conversation";
  const sessionTone = sessionData?.tone || "neutral";
  const totalQuestions = sessionData?.sessionPlan?.questions?.length || 0;
  const activePersona = personas.find(p => p.name === currentPersona) || personas[0];

  const sendTurn = useCallback(async (spokenText) => {
    if (isBusyRef.current || sessionCompleteRef.current || sessionEndedRef.current) return;
    isBusyRef.current = true;
    isAISpeakingRef.current = true;
    setIsAISpeaking(true);

    let fullLine = "";
    let resPersona = null;
    let resVoiceId = null;
    let resVoiceSettings = null;

    try {
      const token = await getIdToken();
      await streamFetch("/api/voice-turn", {
        transcript: spokenText,
        sessionContext: JSON.stringify(sessionData),
        history: historyRef.current,
        currentQuestionIndex: questionIndexRef.current,
      }, chunk => {
        if (chunk.error) { console.error("voice-turn error:", chunk.error); return; }
        if (chunk.chunk) { fullLine += chunk.chunk; setDisplayLine(fullLine); }
        if (chunk.persona) { resPersona = chunk.persona; resVoiceId = chunk.voiceId; resVoiceSettings = chunk.voiceSettings; setCurrentPersona(chunk.persona); }
        if (chunk.done) {
          if (chunk.sessionAdvancing) {
            questionIndexRef.current += 1;
            setQuestionNum(questionIndexRef.current);
          }
          if (chunk.sessionComplete) { sessionCompleteRef.current = true; setSessionComplete(true); }
        }
      }, token);

      if (!fullLine.trim()) {
        isAISpeakingRef.current = false;
        isBusyRef.current = false;
        setIsAISpeaking(false);
        if (!sessionCompleteRef.current && !sessionEndedRef.current && !isListening) {
          setTimeout(() => { if (!sessionEndedRef.current && !sessionCompleteRef.current) start(); }, 400);
        }
        return;
      }

      const aiTurn = { speaker: resPersona || "Panel", text: fullLine, timestamp: Date.now() };
      historyRef.current = [...historyRef.current, aiTurn];
      setHistory([...historyRef.current]);

      const audio = await speakText({
        text: fullLine,
        voiceId: resVoiceId,
        stability: resVoiceSettings?.stability ?? 0.38,
        similarityBoost: resVoiceSettings?.similarityBoost ?? 0.85,
      });
      if (audio && typeof audio.play === "function") {
        currentAudio.current = audio;
        await new Promise(res => {
          audio.onended = res;
          audio.onerror = res;
          audio.play().catch(res);
        });
      }
      setDisplayLine("");
    } catch (e) {
      console.error("sendTurn error:", e);
    }

    isAISpeakingRef.current = false;
    isBusyRef.current = false;
    setIsAISpeaking(false);

    if (!sessionCompleteRef.current && !sessionEndedRef.current && !isListening) {
      setTimeout(() => { if (!sessionEndedRef.current && !sessionCompleteRef.current) start(); }, 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData, getIdToken]);

  const { start, stop, isListening, isProcessing, micError, analyserRef } = useElevenLabsSTT({
    onResult: async (spokenText) => {
      if (isAISpeakingRef.current || isBusyRef.current || sessionCompleteRef.current || sessionEndedRef.current || !spokenText?.trim()) return;
      const userTurn = { speaker: "You", text: spokenText, timestamp: Date.now() };
      historyRef.current = [...historyRef.current, userTurn];
      setHistory([...historyRef.current]);
      await sendTurn(spokenText);
    },
    // Long default threshold: thinking pauses are normal and never cut off
    silenceThresholdMs: timedMode ? 70000 : 5000,
  });

  const handleBegin = useCallback(async (withCamera = false) => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    try {
      const ctx = new AudioContext();
      ctx.resume().then(() => ctx.close());
    } catch { /* audio unlock is best-effort */ }
    if (withCamera) {
      const ok = await trackingRef.current.enable();
      if (!ok) setCameraNote("Camera unavailable. Continuing voice-only; your session works exactly the same.");
    }
    setSessionStarted(true);
    sendTurn("");
  }, [sendTurn]);

  // Stop all audio + mic + camera when component unmounts
  useEffect(() => {
    return () => {
      sessionEndedRef.current = true;
      stop();
      stopAllAudio();
      trackingRef.current.end();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [history]);

  // Timed pressure countdown
  useEffect(() => {
    if (!timedMode) return;
    if (isListening) {
      setCountdown(TIME_LIMIT);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            stop();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(countdownRef.current);
      setCountdown(null);
    }
    return () => clearInterval(countdownRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, timedMode]);

  const handleEnd = () => {
    sessionEndedRef.current = true;
    isBusyRef.current = true;
    stop();

    // Collect derived tracking signals (numbers only; video was never stored)
    if (signalDataRef.current === null) signalDataRef.current = trackingRef.current.end();

    const doEnd = () => onEndSession({
      history, sessionData, situation,
      signalData: signalDataRef.current?.length ? signalDataRef.current : null,
    });

    if (currentAudio.current && !currentAudio.current.ended && !currentAudio.current.paused) {
      const timeout = setTimeout(() => {
        if (currentAudio.current) { currentAudio.current.pause(); currentAudio.current = null; }
        doEnd();
      }, 6000);
      currentAudio.current.onended = () => { clearTimeout(timeout); doEnd(); };
      currentAudio.current.onerror = () => { clearTimeout(timeout); doEnd(); };
    } else {
      if (currentAudio.current) { currentAudio.current.pause(); currentAudio.current = null; }
      doEnd();
    }
  };

  /* ── PANEL INTRO ── */
  if (!sessionStarted) {
    return (
      <motion.div className="screen screen-scroll" variants={sv} initial="initial" animate="animate" exit="exit"
        style={{ background: "var(--ink)" }}>
        <div className="noise" />
        <div className="ambient" />

        <div style={{
          position: "relative", zIndex: 1, minHeight: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "72px 24px 48px", maxWidth: 860, margin: "0 auto", gap: 30,
        }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: "center", maxWidth: 560 }}
          >
            <h1 style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(28px, 4.5vw, 40px)", lineHeight: 1.15, marginBottom: 10 }}>
              {isConvo ? "Meet your conversation partner." : "Meet your panel."}
            </h1>
            <p style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 15, color: "var(--dim)", lineHeight: 1.7 }}>
              {isConvo
                ? "A relaxed chat, at your pace. No question list, no evaluation, end whenever you like."
                : totalQuestions
                ? `They'll ask ${totalQuestions} planned questions, one at a time. You'll always see which question you're on.`
                : "They'll ask their questions one at a time."}
            </p>
            {!isConvo && sessionTone && (
              <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--honey)", letterSpacing: "0.05em", marginTop: 10 }}>
                Tone: {sessionTone.charAt(0).toUpperCase() + sessionTone.slice(1)}
                {sessionTone === "challenging" && ". Interviewers may be more direct and less accommodating."}
                {sessionTone === "supportive" && ". Interviewers will be warm and encouraging."}
              </p>
            )}
          </motion.div>

          {/* Panel assembly — signature moment */}
          <div className="persona-grid" style={{
            "--cols": personas.length <= 3 ? personas.length : Math.ceil(personas.length / 2),
            maxWidth: personas.length === 4 ? 620 : 760,
          }}>
            {personas.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -3 }}
                className="card"
                style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 8, borderTop: `2px solid ${p.color}` }}
              >
                <div style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 17, color: "var(--text)" }}>
                  {p.name}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: p.color, letterSpacing: "0.04em", lineHeight: 1.5 }}>
                  {p.role}
                </div>
                <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 12.5, color: "var(--dim)", lineHeight: 1.6 }}>
                  {p.style}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--dim)", opacity: 0.7, marginTop: "auto", paddingTop: 6 }}>
                  Simulated interviewer. Fictional, not a real person.
                </div>
              </motion.div>
            ))}
          </div>

          {/* Camera consent — clear, optional, voice-only always works */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + personas.length * 0.12, duration: 0.5 }}
            className="card"
            style={{ padding: "20px 22px", maxWidth: 620, display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--calm)", letterSpacing: "0.12em" }}>
              OPTIONAL: CAMERA TRACKING
            </div>
            <p style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}>
              With your permission, your camera can track <strong style={{ fontWeight: 500 }}>posture, head tilt, and mouth movement</strong> during
              the session. Everything is processed on your device. Raw video is never stored and never leaves your computer;
              only derived numbers are kept. Nothing is shown or judged live. Afterward, you choose which observations
              (if any) appear in your private debrief.
            </p>
            {tracking.status === "denied" && (
              <p style={{ fontFamily: "var(--ui)", fontSize: 12.5, color: "var(--dim)", lineHeight: 1.6 }}>
                Camera access declined. No problem: your session runs voice-only and the debrief simply skips tracking sections.
              </p>
            )}
            {cameraNote && (
              <p style={{ fontFamily: "var(--ui)", fontSize: 12.5, color: "var(--dim)", lineHeight: 1.6 }}>{cameraNote}</p>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <button className="btn btn-primary" onClick={() => handleBegin(true)}
                disabled={tracking.status === "starting"}
                style={{ padding: "0 22px", fontSize: 14 }}>
                {tracking.status === "starting" ? "Starting camera…" : "Begin with camera"}
              </button>
              <button className="btn btn-ghost" onClick={() => handleBegin(false)}
                style={{ height: 50, padding: "0 22px", fontSize: 14 }}>
                Begin voice-only
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  /* ── ACTIVE SESSION ── */
  const personaColor = activePersona?.color || "var(--honey)";

  return (
    <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "var(--ink)" }}>
      <div className="noise" />

      <div style={{
        position: "relative", zIndex: 1,
        height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", padding: "28px 20px 108px",
        maxWidth: 680, margin: "0 auto", width: "100%", gap: 18,
      }}>

        {/* Status line */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, alignSelf: "stretch", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: isConvo ? "var(--calm)" : "var(--dim)", letterSpacing: "0.16em" }}>
            {isConvo ? "OPEN CONVERSATION · NO EVALUATION" : "LIVE SESSION"}
          </span>
          {tracking.isTracking && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--calm)", letterSpacing: "0.08em", opacity: 0.7 }}>
              CAMERA ON · PRIVATE · NO LIVE FEEDBACK
            </span>
          )}
        </div>

        {/* The Panel Rail */}
        <PanelRail personas={personas} activeName={activePersona?.name} speaking={isAISpeaking} />

        {/* Active persona identity */}
        <AnimatePresence mode="wait">
          <motion.div key={currentPersona}
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            style={{ textAlign: "center" }}
          >
            <div style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 19, marginBottom: 2 }}>
              {activePersona?.name || "Panel"}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: personaColor, letterSpacing: "0.05em", opacity: 0.9 }}>
              {activePersona?.role || ""}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--dim)", marginTop: 5, opacity: 0.7 }}>
              Simulated interviewer. Fictional, not a real person.
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Question rail — always know where you are (interview mode only) */}
        {!isConvo && <QuestionRail total={totalQuestions} current={questionNum} complete={sessionComplete} />}

        {/* Current spoken line */}
        <AnimatePresence mode="wait">
          {displayLine && (
            <motion.div
              key={displayLine.slice(0, 20)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                padding: "16px 20px", width: "100%",
                fontSize: 15.5, lineHeight: 1.75,
                fontFamily: "var(--ui)", fontWeight: 300,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderLeft: `3px solid ${personaColor}`,
                borderRadius: "var(--radius)",
              }}
            >
              {displayLine}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic waveform while user speaks */}
        <AnimatePresence>
          {isListening && !isAISpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
            >
              <MicWaveform active={isListening} analyserRef={analyserRef} />
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--calm)", letterSpacing: "0.12em", opacity: 0.8 }}>
                LISTENING. TAKE YOUR TIME.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic error */}
        <AnimatePresence>
          {micError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 10,
                background: "rgba(217,139,139,0.07)", border: "1px solid rgba(217,139,139,0.25)",
                fontFamily: "var(--mono)", fontSize: 11, color: "var(--alert)",
              }}
            >
              {micError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transcript */}
        <div
          ref={transcriptRef}
          aria-live="polite"
          style={{
            flex: 1, width: "100%", overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 14,
            scrollbarWidth: "none",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 10%)",
            paddingTop: 6,
          }}
        >
          {history.map((turn, i) => {
            const p = personas.find(x => x.name === turn.speaker);
            const isUser = turn.speaker === "You";
            const isLast = i === history.length - 1;
            const tColor = isUser ? "var(--calm)" : (p?.color || "var(--honey)");
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", color: tColor }}>
                  {turn.speaker.toUpperCase()}
                </span>
                <span style={{
                  fontSize: 14, fontFamily: "var(--ui)", fontWeight: 300,
                  color: "var(--text)", lineHeight: 1.65,
                  opacity: isLast ? 1 : 0.5,
                  transition: "opacity 0.3s",
                }}>
                  {turn.text}
                </span>
              </motion.div>
            );
          })}

          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", color: "var(--calm)" }}>YOU</span>
                <span style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.65, opacity: 0.45, fontStyle: "italic" }}>
                  Writing down what you said…
                  <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }}>|</motion.span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{
        position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 10, zIndex: 20,
      }}>
        <AnimatePresence>
          {(isListening || isProcessing) && (
            <motion.button
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={() => !isProcessing && stop()}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "var(--calm-soft)",
                border: "1px solid rgba(116,185,160,0.3)",
                borderRadius: 999, padding: "10px 20px",
                color: "inherit", cursor: "pointer",
              }}
            >
              <span className="dot" style={{ background: "var(--calm)", width: 5, height: 5 }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--calm)", letterSpacing: "0.07em" }}>
                {isProcessing ? "TRANSCRIBING" : "LISTENING. TAP WHEN DONE."}
              </span>
              {timedMode && countdown !== null && <CountdownRing seconds={countdown} />}
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAISpeaking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "var(--honey-soft)",
                border: "1px solid rgba(228,163,57,0.3)",
                borderRadius: 999, padding: "10px 20px",
              }}
            >
              <span className="dot" style={{ background: "var(--honey)", width: 5, height: 5 }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--honey)", letterSpacing: "0.07em" }}>
                {(activePersona?.name || "PANEL").split(/\s+/)[0].toUpperCase()} IS SPEAKING
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Self-view camera mirror (only when camera tracking is on) */}
      <SelfView stream={tracking.previewStream} />

      {/* End session button */}
      <button className="btn btn-ghost" onClick={() => setShowConfirm(true)}
        style={{ position: "fixed", bottom: 26, right: 24, zIndex: 20, height: 36, fontSize: 12, padding: "0 16px" }}>
        {isConvo ? "End conversation" : "End session"}
      </button>

      {/* Session complete overlay */}
      <AnimatePresence>
        {sessionComplete && !showConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{
              position: "fixed", bottom: 82, left: "50%", transform: "translateX(-50%)",
              background: "var(--calm-soft)",
              border: "1px solid rgba(116,185,160,0.35)",
              borderRadius: 12, padding: "12px 20px",
              zIndex: 20, display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <span style={{ color: "var(--calm)", fontSize: 13 }}>✓</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--calm)", letterSpacing: "0.06em" }}>
              Session complete
            </span>
            <button className="btn btn-primary" onClick={handleEnd}
              style={{ height: 32, fontSize: 12, padding: "0 14px", borderRadius: 8 }}>
              See your debrief
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, background: "rgba(8,10,16,0.85)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 100,
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 18 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="card"
              style={{
                background: "var(--surface)",
                padding: 36, maxWidth: 360, width: "90%",
                display: "flex", flexDirection: "column", gap: 20, textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 21, marginBottom: 10 }}>
                  {isConvo ? "End the conversation?" : "End the session?"}
                </div>
                <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 14, color: "var(--dim)", lineHeight: 1.7 }}>
                  {isConvo
                    ? "You'll get a short optional recap and your transcript. No evaluation."
                    : "You'll get a private debrief: your panel's impressions and your full transcript. No scores."}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-primary" onClick={handleEnd} style={{ flex: 1, fontSize: 14 }}>
                  {isConvo ? "End conversation" : "End session"}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowConfirm(false)} style={{ flex: 1, height: 50 }}>Keep going</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
