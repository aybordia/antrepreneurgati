import { useRef, useState, useCallback } from "react";

export function useVoiceInput({ onResult, onSilence, silenceThresholdMs = 2000 } = {}) {
  const recRef = useRef(null);
  const silenceTimer = useRef(null);
  const latestTranscript = useRef("");
  const accumulatedFinals = useRef(""); // persists across auto-restarts
  const wantListening = useRef(false);  // true when user has clicked start

  const onResultRef = useRef(onResult);
  const onSilenceRef = useRef(onSilence);
  onResultRef.current = onResult;
  onSilenceRef.current = onSilence;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [micError, setMicError] = useState(null);

  // Internal: create and start a recognition session, appending to existing finals
  const _startRec = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    if (recRef.current) {
      try { recRef.current.onend = null; recRef.current.stop(); } catch {}
      recRef.current = null;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;
    recRef.current = rec;

    rec.onresult = (event) => {
      clearTimeout(silenceTimer.current);

      // Build finals for THIS session only (from resultIndex onward)
      let sessionFinals = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          sessionFinals += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      // Full text = all-time accumulated finals + this session's finals + current interim
      const fullText = accumulatedFinals.current + sessionFinals + interimText;
      latestTranscript.current = fullText;
      setInterimTranscript(interimText);
      onResultRef.current?.(fullText);

      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        // Commit this session's finals into accumulated
        accumulatedFinals.current += sessionFinals;
        setInterimTranscript("");
        silenceTimer.current = setTimeout(() => {
          onSilenceRef.current?.(latestTranscript.current);
        }, silenceThresholdMs);
      }
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed") {
        setMicError("Microphone access denied. Go to System Settings → Privacy → Microphone and enable your browser.");
        wantListening.current = false;
        setIsListening(false);
        recRef.current = null;
      } else if (e.error === "audio-capture") {
        setMicError("No microphone found. Please connect a mic and try again.");
        wantListening.current = false;
        setIsListening(false);
        recRef.current = null;
      } else if (e.error === "aborted") {
        // Intentional abort — ignore
      } else {
        console.warn("[voice] error:", e.error);
      }
    };

    rec.onend = () => {
      if (recRef.current !== rec) return; // stale session
      recRef.current = null;
      setInterimTranscript("");

      if (wantListening.current) {
        // Chrome killed it mid-session — auto-restart to keep going
        setTimeout(() => { if (wantListening.current) _startRec(); }, 80);
      } else {
        setIsListening(false);
      }
    };

    try {
      rec.start();
    } catch (e) {
      console.error("[voice] rec.start() threw:", e);
      recRef.current = null;
    }
  }, [silenceThresholdMs]);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicError("Speech recognition not supported. Please use Chrome or Edge.");
      return false;
    }

    clearTimeout(silenceTimer.current);
    setMicError(null);
    // Reset all accumulated state for a fresh session
    accumulatedFinals.current = "";
    latestTranscript.current = "";
    setInterimTranscript("");
    wantListening.current = true;
    setIsListening(true);
    _startRec();
    return true;
  }, [_startRec]);

  const stop = useCallback(() => {
    clearTimeout(silenceTimer.current);
    wantListening.current = false;
    setIsListening(false);
    setInterimTranscript("");
    if (recRef.current) {
      const rec = recRef.current;
      recRef.current = null;
      rec.onend = null;
      try { rec.stop(); } catch {}
    }
  }, []);

  return { start, stop, isListening, interimTranscript, micError };
}
