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

const WAVEFORM_BARS = 28;

function WaveformVisualizer({ active, color = "#7B6CFF" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px", height: "28px" }}>
      {Array.from({ length: WAVEFORM_BARS }).map((_, i) => {
        const baseH = 4 + Math.sin(i * 0.8 + 1) * 4 + Math.cos(i * 0.45) * 3;
        return (
          <div
            key={i}
            style={{
              width: "2.5px",
              height: `${baseH}px`,
              borderRadius: "3px",
              background: color,
              animation: active
                ? `waveBar ${0.65 + (i % 7) * 0.09}s ease-in-out ${(i % 5) * 0.065}s infinite alternate`
                : "none",
              opacity: active ? 0.75 : 0.12,
              transition: "opacity 0.4s",
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
  const [sessionStarted, setSessionStarted] = useState(false);

  const transcriptRef = useRef(null);
  const currentAudio = useRef(null);
  const historyRef = useRef([]);
  const questionIndexRef = useRef(0);
  const isAISpeakingRef = useRef(false);
  const sessionCompleteRef = useRef(false);
  const isBusyRef = useRef(false);
  const hasInitRef = useRef(false);
  const sessionEndedRef = useRef(false);

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

      const audio = await speakText({ text: fullLine, voiceId: resVoiceId, stability: 0.38, similarityBoost: 0.85 });
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

  const handleBegin = useCallback(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    try {
      const ctx = new AudioContext();
      ctx.resume().then(() => ctx.close());
    } catch {}
    setSessionStarted(true);
    sendTurn("");
  }, [sendTurn]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [history]);

  const handleEnd = () => {
    sessionEndedRef.current = true;
    isBusyRef.current = true;
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.src = "";
      currentAudio.current = null;
    }
    stop();
    onEndSession({ history, sessionData, situation });
  };

  /* ── BEGIN SCREEN ── */
  if (!sessionStarted) {
    return (
      <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
        style={{ background: "#060608", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div className="noise" />

        {/* Deep ambient glow */}
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse 60% 50% at 50% 60%, ${personas[0]?.color || "#7B6CFF"}12 0%, transparent 70%)`,
        }} />

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px", textAlign: "center", padding: "40px", maxWidth: "440px" }}
        >
          {/* Orb */}
          <div style={{ position: "relative" }}>
            <OrbScene color={personas[0]?.color || "#7B6CFF"} speaking={false} size={160} />
            <div style={{
              position: "absolute", inset: "-40px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${personas[0]?.color || "#7B6CFF"}18 0%, transparent 70%)`,
              pointerEvents: "none",
              animation: "orbPulse 3s ease-in-out infinite",
            }} />
          </div>

          <div>
            <div style={{
              fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)",
              letterSpacing: "0.2em", marginBottom: "14px",
            }}>
              PHASE 3 OF 4 — LIVE SESSION
            </div>
            <div style={{ fontFamily: "var(--display)", fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 300, marginBottom: "14px" }}>
              Your panel is assembled.
            </div>
            <div style={{
              fontFamily: "var(--ui)", fontWeight: 300,
              fontSize: "15px", color: "var(--muted)", lineHeight: 1.7, maxWidth: "340px",
            }}>
              {sessionData?.openingLine
                ? `"${sessionData.openingLine}"`
                : "Five specialists are ready. Click Begin to start your live interview."}
            </div>
          </div>

          {/* Persona pills */}
          {personas.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", justifyContent: "center" }}>
              {personas.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 + 0.3 }}
                  style={{
                    padding: "4px 12px", borderRadius: "999px",
                    background: `${p.color}12`,
                    border: `1px solid ${p.color}30`,
                    fontFamily: "var(--mono)", fontSize: "10px",
                    color: p.color, letterSpacing: "0.06em",
                  }}
                >
                  {p.name}
                </motion.div>
              ))}
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-primary"
            onClick={handleBegin}
            style={{ fontSize: "15px", padding: "14px 48px", borderRadius: "12px" }}
          >
            Begin Session →
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  /* ── ACTIVE SESSION ── */
  const personaColor = activePersona?.color || "#7B6CFF";

  return (
    <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "#060608" }}
    >
      <div className="noise" />

      {/* Dynamic color ambient behind orb */}
      <motion.div
        animate={{ background: `radial-gradient(ellipse 55% 45% at 50% 35%, ${personaColor}14 0%, transparent 65%)` }}
        transition={{ duration: 1.2 }}
        style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
      />

      {/* Subtle grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), " +
          "linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", padding: "36px 24px 120px",
        maxWidth: "620px", margin: "0 auto", width: "100%", gap: "16px",
      }}>

        {/* Phase label */}
        <div style={{
          fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)",
          letterSpacing: "0.2em", alignSelf: "flex-start",
        }}>
          LIVE SESSION
        </div>

        {/* 3D Orb with color-changing halo */}
        <AnimatePresence mode="wait">
          <motion.div key={activePersona?.name}
            initial={{ opacity: 0, scale: 0.75, filter: "blur(16px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(12px)" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: "relative" }}
          >
            <OrbScene color={personaColor} speaking={isAISpeaking} size={160} />
            <motion.div
              animate={{
                background: `radial-gradient(circle, ${personaColor}28 0%, transparent 70%)`,
                transform: isAISpeaking ? "scale(1.12)" : "scale(1)",
              }}
              transition={{ duration: 0.6 }}
              style={{
                position: "absolute", inset: "-32px",
                borderRadius: "50%",
                pointerEvents: "none",
              }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Persona name + role */}
        <AnimatePresence mode="wait">
          <motion.div key={currentPersona}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            style={{ textAlign: "center" }}
          >
            <div style={{
              fontFamily: "var(--display)", fontSize: "18px",
              letterSpacing: "0.01em", marginBottom: "4px",
            }}>
              {activePersona?.name || "Panel"}
            </div>
            <div style={{
              fontFamily: "var(--mono)", fontSize: "10px",
              color: personaColor, letterSpacing: "0.1em", opacity: 0.8,
            }}>
              {activePersona?.role || ""}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Waveform */}
        <AnimatePresence>
          {isAISpeaking && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <WaveformVisualizer active={isAISpeaking} color={personaColor} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current display line */}
        <AnimatePresence mode="wait">
          {displayLine && (
            <motion.div
              key={displayLine.slice(0, 20)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                padding: "18px 22px", width: "100%",
                fontSize: "15px", lineHeight: 1.75,
                borderLeft: `2px solid ${personaColor}`,
                fontFamily: "var(--ui)", fontWeight: 300,
                background: `${personaColor}07`,
                border: `1px solid ${personaColor}18`,
                borderRadius: "14px",
                backdropFilter: "blur(8px)",
              }}
            >
              {displayLine}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic error */}
        <AnimatePresence>
          {micError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: "10px",
                background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)",
                fontFamily: "var(--mono)", fontSize: "11px", color: "var(--coral)",
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
            display: "flex", flexDirection: "column", gap: "14px",
            scrollbarWidth: "none",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 10%)",
            paddingTop: "6px",
          }}
        >
          {history.map((turn, i) => {
            const p = personas.find(x => x.name === turn.speaker);
            const isUser = turn.speaker === "You";
            const isLast = i === history.length - 1;
            const tColor = isUser ? "var(--amber)" : (p?.color || "var(--teal)");
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <span style={{
                  fontFamily: "var(--mono)", fontSize: "9px",
                  letterSpacing: "0.12em", color: tColor,
                }}>
                  {turn.speaker.toUpperCase()}
                </span>
                <span style={{
                  fontSize: "14px", fontFamily: "var(--ui)", fontWeight: 300,
                  color: "var(--text)", lineHeight: 1.65,
                  opacity: isLast ? 1 : 0.45,
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
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <span style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.12em", color: "var(--amber)" }}>YOU</span>
                <span style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.65, opacity: 0.4, fontStyle: "italic" }}>
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
        position: "fixed", bottom: "32px", left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: "10px", zIndex: 20,
      }}>
        <AnimatePresence>
          {(isListening || isProcessing) && (
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => !isProcessing && stop()}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                background: "rgba(245,166,35,0.08)",
                border: "1px solid rgba(245,166,35,0.22)",
                borderRadius: "999px", padding: "10px 20px",
                backdropFilter: "blur(16px)",
                color: "inherit",
              }}
            >
              <span className="dot" style={{ background: "var(--amber)", width: "5px", height: "5px" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--amber)", letterSpacing: "0.08em" }}>
                {isProcessing ? "TRANSCRIBING" : "LISTENING — TAP TO SEND"}
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAISpeaking && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                background: "rgba(123,108,255,0.08)",
                border: "1px solid rgba(123,108,255,0.22)",
                borderRadius: "999px", padding: "10px 20px",
                backdropFilter: "blur(16px)",
              }}
            >
              <span className="dot" style={{ background: "var(--primary)", width: "5px", height: "5px" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--primary)", letterSpacing: "0.08em" }}>
                SPEAKING
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* End session button */}
      <button className="btn btn-ghost" onClick={() => setShowConfirm(true)}
        style={{ position: "fixed", bottom: "26px", right: "24px", zIndex: 20, height: "36px", fontSize: "12px", padding: "0 16px", borderRadius: "10px" }}
      >
        End Session
      </button>

      {/* Session complete overlay */}
      <AnimatePresence>
        {sessionComplete && !showConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{
              position: "fixed", bottom: "82px", left: "50%", transform: "translateX(-50%)",
              background: "rgba(200,240,100,0.07)",
              border: "1px solid rgba(200,240,100,0.25)",
              borderRadius: "14px", padding: "12px 20px",
              backdropFilter: "blur(16px)", zIndex: 20,
              display: "flex", alignItems: "center", gap: "12px",
            }}
          >
            <span style={{ color: "var(--success)", fontSize: "13px" }}>✓</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--success)", letterSpacing: "0.07em" }}>
              Session complete
            </span>
            <button
              className="btn btn-primary"
              onClick={handleEnd}
              style={{ height: "30px", fontSize: "11px", padding: "0 14px", borderRadius: "7px" }}
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
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 100, backdropFilter: "blur(16px)",
            }}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: "#0A0A10",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "22px", padding: "40px",
                maxWidth: "360px", width: "90%",
                display: "flex", flexDirection: "column", gap: "22px",
                textAlign: "center",
                boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--display)", fontSize: "22px", marginBottom: "12px" }}>End session?</div>
                <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "14px", color: "var(--muted)", lineHeight: 1.7 }}>
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
