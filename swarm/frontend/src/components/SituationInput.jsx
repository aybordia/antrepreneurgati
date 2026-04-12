import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ParticleField from "./ParticleField";
import { useElevenLabsSTT } from "../hooks/useElevenLabsSTT";

const EXAMPLES = [
  { label: "MIT CS interview in 2 days — I always freeze on 'why MIT'", tag: "Admissions" },
  { label: "Pitching to Sequoia next week — they'll push hard on our moat", tag: "Venture" },
  { label: "Salary negotiation tomorrow — I tend to undersell myself", tag: "Career" },
  { label: "Stanford med school interview — MMI format, ethical scenarios", tag: "Medical" },
];

const sv = {
  initial: { opacity: 0, scale: 0.97, filter: "blur(12px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 1.02, filter: "blur(8px)", transition: { duration: 0.4, ease: [0.4, 0, 1, 1] } },
};

export default function SituationInput({ onLaunch, initialSituation = "" }) {
  const [situation, setSituation] = useState(initialSituation);
  const [exIdx, setExIdx] = useState(0);
  const [exVisible, setExVisible] = useState(true);
  const [amplitude, setAmplitude] = useState(0);

  const { start, stop, isListening, isProcessing, micError } = useElevenLabsSTT({
    onResult: (t) => setSituation(t),
    silenceThresholdMs: 3000,
  });

  useEffect(() => {
    const id = setInterval(() => {
      setExVisible(false);
      setTimeout(() => { setExIdx(i => (i + 1) % EXAMPLES.length); setExVisible(true); }, 320);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Fake amplitude pulse when listening
  useEffect(() => {
    if (!isListening) { setAmplitude(0); return; }
    const id = setInterval(() => setAmplitude(25 + Math.random() * 65), 110);
    return () => clearInterval(id);
  }, [isListening]);

  const canLaunch = situation.trim().length >= 10;

  return (
    <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit">
      <div className="ambient" />
      <ParticleField amplitude={amplitude} />

      {/* Center layout */}
      <div style={{
        position: "relative", zIndex: 10,
        height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 24px",
      }}>
        <div style={{ width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", gap: "26px" }}>

          {/* Wordmark */}
          <div style={{ textAlign: "center" }}>
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              style={{ fontFamily: "var(--mono)", fontSize: "11px", letterSpacing: "0.55em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "16px" }}
            >
              ⬡ SWARM
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.7 }}
              style={{ fontFamily: "var(--display)", fontSize: "clamp(30px,5vw,48px)", fontWeight: 400, lineHeight: 1.18, color: "var(--text)", marginBottom: "12px" }}
            >
              Prepare for what's<br /><em style={{ color: "var(--primary)" }}>actually</em> coming.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28, duration: 0.6 }}
              style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "15px", color: "var(--muted)", lineHeight: 1.65 }}
            >
              Five AI agents research your exact situation and build a custom panel — live.
            </motion.p>
          </div>

          {/* Input */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.6 }}
            style={{ position: "relative" }}
          >
            <textarea
              value={situation}
              onChange={e => { if (!isListening && !isProcessing) setSituation(e.target.value); }}
              placeholder={isListening ? "Listening — speak your situation..." : isProcessing ? "Transcribing..." : "Describe your situation in one sentence..."}
              rows={3}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && canLaunch) { e.preventDefault(); onLaunch(situation.trim()); } }}
              style={{
                width: "100%",
                background: isListening ? "rgba(245,166,35,0.04)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${isListening ? "rgba(245,166,35,0.55)" : canLaunch ? "rgba(123,108,255,0.55)" : "rgba(255,255,255,0.09)"}`,
                borderRadius: "14px",
                padding: "18px 56px 18px 20px",
                fontSize: "16px",
                fontFamily: "var(--ui)",
                color: "var(--text)",
                outline: "none",
                resize: "none",
                lineHeight: 1.65,
                boxShadow: isListening
                  ? "0 0 0 3px rgba(245,166,35,0.12)"
                  : canLaunch
                  ? "0 0 0 3px rgba(123,108,255,0.10)"
                  : "none",
                transition: "border-color 0.25s, box-shadow 0.25s, background 0.25s",
                backdropFilter: "blur(12px)",
              }}
            />

            {/* Status indicator */}
            <AnimatePresence>
              {(isListening || isProcessing) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ position: "absolute", top: "13px", right: "13px", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span className="dot" style={{ background: isProcessing ? "var(--primary)" : "var(--amber)", width: "6px", height: "6px" }} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: isProcessing ? "var(--primary)" : "var(--amber)", letterSpacing: "0.05em" }}>
                    {isProcessing ? "Transcribing..." : "Listening"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mic button */}
            <button
              onClick={() => isListening ? stop() : start()}
              disabled={isProcessing}
              aria-label="Toggle voice input"
              style={{
                position: "absolute", right: "13px", bottom: "13px",
                width: "38px", height: "38px", borderRadius: "50%", border: "none",
                cursor: isProcessing ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "17px",
                background: isListening ? "rgba(245,166,35,0.2)" : isProcessing ? "rgba(123,108,255,0.15)" : "rgba(255,255,255,0.08)",
                color: isListening ? "var(--amber)" : isProcessing ? "var(--primary)" : "rgba(255,255,255,0.5)",
                animation: isListening ? "micRing 1.1s ease-out infinite" : "none",
                transition: "all 0.2s",
                boxShadow: isListening ? "0 0 12px rgba(245,166,35,0.3)" : "none",
                opacity: isProcessing ? 0.6 : 1,
              }}
            >
              {isProcessing ? "⏳" : isListening ? "⏹" : "🎤"}
            </button>
          </motion.div>

          {/* Hint text below input */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  fontFamily: "var(--mono)", fontSize: "11px", color: "var(--amber)",
                  opacity: 0.75, marginTop: "-14px",
                }}
              >
                <span>Speak now — auto-stops after a pause</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mic error */}
          <AnimatePresence>
            {micError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  padding: "10px 14px", borderRadius: "10px",
                  background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)",
                  fontFamily: "var(--mono)", fontSize: "11px", color: "var(--coral)", lineHeight: 1.5,
                }}
              >
                {micError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Launch button */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.6 }}
          >
            <button
              className={`btn ${canLaunch ? "btn-primary" : ""}`}
              onClick={() => canLaunch && onLaunch(situation.trim())}
              disabled={!canLaunch}
              style={{
                opacity: canLaunch ? 1 : 0.3,
                cursor: canLaunch ? "pointer" : "not-allowed",
                width: "100%",
                background: canLaunch ? undefined : "rgba(255,255,255,0.05)",
                border: canLaunch ? "none" : "1px solid rgba(255,255,255,0.08)",
                color: "white",
                letterSpacing: "0.025em",
              }}
            >
              {canLaunch ? "Launch Swarm →" : "Describe your situation to begin"}
            </button>
          </motion.div>

          {/* Examples */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "rgba(139,138,155,0.45)", letterSpacing: "0.1em" }}>TRY</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setSituation(ex.label)}
                  style={{
                    background: i === exIdx && exVisible ? "rgba(123,108,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${i === exIdx && exVisible ? "rgba(123,108,255,0.28)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: "8px", padding: "5px 12px", cursor: "pointer",
                    fontFamily: "var(--mono)", fontSize: "11px",
                    color: i === exIdx && exVisible ? "var(--primary)" : "var(--muted)",
                    transition: "all 0.35s ease",
                    letterSpacing: "0.04em",
                  }}
                >
                  {ex.tag}
                </button>
              ))}
            </div>
            <motion.div
              animate={{ opacity: exVisible ? 0.75 : 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setSituation(EXAMPLES[exIdx].label)}
              style={{
                fontFamily: "var(--mono)", fontSize: "12px",
                color: "var(--muted)", lineHeight: 1.55,
                cursor: "pointer",
              }}
            >
              "{EXAMPLES[exIdx].label}"
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
