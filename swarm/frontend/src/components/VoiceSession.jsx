import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { streamFetch } from "../lib/api";
import { speakText } from "../hooks/useVoiceOutput";
import { useElevenLabsSTT } from "../hooks/useElevenLabsSTT";
import OrbScene from "./OrbScene";

const sv = {
  initial: { opacity: 0, filter: "blur(12px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, filter: "blur(10px)", transition: { duration: 0.4 } },
};

const WAVEFORM_BARS = 30;

function WaveformVisualizer({ active, color = "#7B6CFF" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2.5px", height: "36px" }}>
      {Array.from({ length: WAVEFORM_BARS }).map((_, i) => {
        const baseH = 6 + Math.sin(i * 0.75 + 1) * 5 + Math.cos(i * 0.4) * 4;
        return (
          <div
            key={i}
            style={{
              width: "3px",
              height: `${baseH}px`,
              borderRadius: "3px",
              background: color,
              animation: active ? `waveBar ${0.7 + (i % 7) * 0.08}s ease-in-out ${(i % 5) * 0.06}s infinite alternate` : "none",
              opacity: active ? 0.85 : 0.18,
              transition: "opacity 0.4s, height 0.4s",
              transformOrigin: "bottom",
            }}
          />
        );
      })}
    </div>
  );
}

export default function VoiceSession({ sessionData, situation, onEndSession, getIdToken }) {
  const [history, setHistory] = useState([]);
  const [currentPersona, setCurrentPersona] = useState(null);
  const [displayLine, setDisplayLine] = useState("");
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  const transcriptRef = useRef(null);
  const currentAudio = useRef(null);
  const historyRef = useRef([]);
  const questionIndexRef = useRef(0);
  const isAISpeakingRef = useRef(false);
  const sessionCompleteRef = useRef(false);
  const isBusyRef = useRef(false);
  const hasInitRef = useRef(false); // guard against StrictMode double-invoke
  const sessionEndedRef = useRef(false); // set when user clicks End Session

  const personas = sessionData?.personas || [];
  const activePersona = personas.find(p => p.name === currentPersona) || personas[0];

  const sendTurn = useCallback(async (spokenText) => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    isAISpeakingRef.current = true;
    setIsAISpeaking(true);

    let fullLine = "";
    let resPersona = null;
    let resVoiceId = null;

    try {
      const token = await getIdToken();
      await streamFetch("/api/voice-turn", {
        transcript: spokenText,
        sessionContext: JSON.stringify(sessionData),
        history: historyRef.current,
        currentQuestionIndex: questionIndexRef.current,
      }, chunk => {
        if (chunk.chunk) { fullLine += chunk.chunk; setDisplayLine(fullLine); }
        if (chunk.persona) { resPersona = chunk.persona; resVoiceId = chunk.voiceId; setCurrentPersona(chunk.persona); }
        if (chunk.done) {
          if (chunk.sessionAdvancing) questionIndexRef.current += 1;
          if (chunk.sessionComplete) { sessionCompleteRef.current = true; setSessionComplete(true); }
        }
      }, token);

      const aiTurn = { speaker: resPersona || "Panel", text: fullLine, timestamp: Date.now() };
      historyRef.current = [...historyRef.current, aiTurn];
      setHistory([...historyRef.current]);

      const audio = await speakText({ text: fullLine, voiceId: resVoiceId });
      if (audio && typeof audio.play === "function") {
        currentAudio.current = audio;
        await new Promise(res => {
          audio.onended = res;
          audio.onerror = res;
          audio.play().catch(res);
        });
      }
    } catch (e) {
      console.error("sendTurn error:", e);
    }

    isAISpeakingRef.current = false;
    isBusyRef.current = false;
    setIsAISpeaking(false);

    if (!sessionCompleteRef.current && !sessionEndedRef.current) {
      setTimeout(() => { if (!sessionEndedRef.current) start(); }, 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData, getIdToken]);

  const { start, stop, isListening, isProcessing, micError } = useElevenLabsSTT({
    onResult: async (spokenText) => {
      if (isAISpeakingRef.current || isBusyRef.current || !spokenText?.trim()) return;
      const userTurn = { speaker: "You", text: spokenText, timestamp: Date.now() };
      historyRef.current = [...historyRef.current, userTurn];
      setHistory([...historyRef.current]);
      await sendTurn(spokenText);
    },
    silenceThresholdMs: 2000,
  });

  // Kick off session once
  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    sendTurn("");
  }, [sendTurn]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [history]);

  const handleEnd = () => {
    sessionEndedRef.current = true;
    isBusyRef.current = true; // prevent any in-flight sendTurn from re-starting mic
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.src = "";
      currentAudio.current = null;
    }
    stop();
    onEndSession({ history, sessionData, situation });
  };

  return (
    <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "#070709" }}
    >
      <div className="ambient" />

      {/* Grid lines overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(123,108,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(123,108,255,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", padding: "36px 24px 110px",
        maxWidth: "660px", margin: "0 auto", width: "100%", gap: "20px",
      }}>

        {/* Phase label */}
        <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: "0.18em", alignSelf: "flex-start" }}>
          PHASE 3 OF 4 — LIVE SESSION
        </div>

        {/* 3D Orb */}
        <AnimatePresence mode="wait">
          <motion.div key={activePersona?.name}
            initial={{ opacity: 0, scale: 0.75, filter: "blur(16px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(12px)" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: "relative" }}
          >
            <OrbScene color={activePersona?.color || "#7B6CFF"} speaking={isAISpeaking} size={180} />
            {/* Glow halo behind orb */}
            <div style={{
              position: "absolute", inset: "-30px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${activePersona?.color || "#7B6CFF"}22 0%, transparent 70%)`,
              pointerEvents: "none",
              animation: isAISpeaking ? "orbPulse 2s ease-in-out infinite" : "none",
            }} />
          </motion.div>
        </AnimatePresence>

        {/* Persona name + role */}
        <AnimatePresence mode="wait">
          <motion.div key={currentPersona}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35 }}
            style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "4px" }}
          >
            <div style={{ fontFamily: "var(--display)", fontSize: "18px", letterSpacing: "0.01em" }}>
              {activePersona?.name || "Panel"}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: "0.08em" }}>
              {activePersona?.role || ""}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Waveform during AI speaking */}
        <AnimatePresence>
          {isAISpeaking && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <WaveformVisualizer active={isAISpeaking} color={activePersona?.color || "#7B6CFF"} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current display line */}
        <AnimatePresence mode="wait">
          {displayLine && (
            <motion.div
              key={displayLine.slice(0, 20)}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="card"
              style={{
                padding: "18px 22px", width: "100%", fontSize: "15px",
                lineHeight: 1.75, borderLeft: `3px solid ${activePersona?.color || "#7B6CFF"}`,
                fontFamily: "var(--ui)",
              }}
            >
              {displayLine}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic error banner */}
        <AnimatePresence>
          {micError && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: "10px",
                background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.25)",
                fontFamily: "var(--mono)", fontSize: "12px", color: "var(--coral)",
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
            display: "flex", flexDirection: "column", gap: "16px",
            scrollbarWidth: "none",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 12%)",
            paddingTop: "8px",
          }}
        >
          {history.map((turn, i) => {
            const p = personas.find(x => x.name === turn.speaker);
            const isUser = turn.speaker === "You";
            const isLast = i === history.length - 1;
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: "flex", flexDirection: "column", gap: "4px",
                  paddingLeft: isUser ? "0" : "0",
                }}
              >
                <span style={{
                  fontFamily: "var(--mono)", fontSize: "10px", letterSpacing: "0.1em",
                  color: isUser ? "var(--amber)" : (p?.color || "var(--teal)"),
                }}>
                  {turn.speaker.toUpperCase()}
                </span>
                <span style={{
                  fontSize: "14px", color: "var(--text)", lineHeight: 1.65,
                  opacity: isLast ? 1 : 0.52,
                  transition: "opacity 0.3s",
                }}>
                  {turn.text}
                </span>
              </motion.div>
            );
          })}

          {/* Processing indicator while ElevenLabs transcribes */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <span style={{ fontFamily: "var(--mono)", fontSize: "10px", letterSpacing: "0.1em", color: "var(--amber)" }}>
                  YOU
                </span>
                <span style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.65, opacity: 0.45, fontStyle: "italic" }}>
                  Transcribing…
                  <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }}>|</motion.span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{
        position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: "10px", zIndex: 20,
      }}>
        <AnimatePresence>
          {(isListening || isProcessing) && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => !isProcessing && stop()}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                background: "rgba(245,166,35,0.1)",
                border: "1px solid rgba(245,166,35,0.25)",
                borderRadius: "999px", padding: "9px 18px",
                backdropFilter: "blur(12px)",
                cursor: isProcessing ? "default" : "pointer",
                color: "inherit",
              }}
            >
              <span className="dot" style={{ background: "var(--amber)", width: "6px", height: "6px" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--amber)", letterSpacing: "0.06em" }}>
                {isProcessing ? "Transcribing…" : "Listening — tap to send"}
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAISpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                background: "rgba(123,108,255,0.1)",
                border: "1px solid rgba(123,108,255,0.25)",
                borderRadius: "999px", padding: "9px 18px",
                backdropFilter: "blur(12px)",
              }}
            >
              <span className="dot" style={{ background: "var(--primary)", width: "6px", height: "6px" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--primary)", letterSpacing: "0.06em" }}>
                Speaking
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* End session button */}
      <button className="btn btn-ghost" onClick={() => setShowConfirm(true)}
        style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 20 }}
      >
        End Session
      </button>

      {/* Session complete overlay */}
      <AnimatePresence>
        {sessionComplete && !showConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
              background: "rgba(200,240,100,0.1)", border: "1px solid rgba(200,240,100,0.3)",
              borderRadius: "12px", padding: "12px 22px", backdropFilter: "blur(12px)", zIndex: 20,
              display: "flex", alignItems: "center", gap: "10px",
            }}
          >
            <span style={{ color: "var(--success)", fontSize: "14px" }}>✓</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "var(--success)", letterSpacing: "0.06em" }}>
              Session complete — ready for debrief
            </span>
            <button
              className="btn btn-primary"
              onClick={handleEnd}
              style={{ height: "32px", fontSize: "12px", padding: "0 16px", borderRadius: "8px" }}
            >
              Get Debrief →
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
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 100, backdropFilter: "blur(6px)",
            }}
          >
            <motion.div
              className="card"
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ padding: "40px", maxWidth: "380px", width: "90%", display: "flex", flexDirection: "column", gap: "22px", textAlign: "center" }}
            >
              <div>
                <div style={{ fontFamily: "var(--display)", fontSize: "22px", marginBottom: "10px" }}>End session?</div>
                <div style={{ fontFamily: "var(--ui)", fontSize: "14px", color: "var(--muted)", lineHeight: 1.65 }}>
                  Your responses will be analysed and you'll receive a detailed debrief.
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-primary" onClick={handleEnd} style={{ flex: 1 }}>Get My Debrief</button>
                <button className="btn btn-ghost" onClick={() => setShowConfirm(false)} style={{ flex: 1 }}>Continue</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
