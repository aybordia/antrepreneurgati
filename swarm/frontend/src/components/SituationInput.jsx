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
  initial: { opacity: 0, scale: 0.98, filter: "blur(16px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 1.01, filter: "blur(10px)", transition: { duration: 0.4 } },
};

export default function SituationInput({ onLaunch, onBack, initialSituation = "" }) {
  const [situation, setSituation] = useState(initialSituation);
  const [resumeContext, setResumeContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [timedMode, setTimedMode] = useState(false);
  const [exIdx, setExIdx] = useState(0);
  const [exVisible, setExVisible] = useState(true);
  const [amplitude, setAmplitude] = useState(0);
  const [focused, setFocused] = useState(false);

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

  useEffect(() => {
    if (!isListening) { setAmplitude(0); return; }
    const id = setInterval(() => setAmplitude(25 + Math.random() * 65), 110);
    return () => clearInterval(id);
  }, [isListening]);

  const canLaunch = situation.trim().length >= 10;
  const isActive  = isListening || focused || canLaunch;

  const handleLaunch = () => {
    if (!canLaunch) return;
    const finalText = resumeContext.trim()
      ? `${situation.trim()}\n\n[Candidate background: ${resumeContext.trim()}]`
      : situation.trim();
    onLaunch(finalText, { timedMode });
  };

  return (
    <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "var(--bg)" }}
    >
      <div className="ambient" />
      <ParticleField amplitude={amplitude} />
      <div className="noise" />

      {/* Radial glow behind input */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px", height: "400px",
        borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(123,108,255,0.06) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
        transition: "opacity 0.5s",
        opacity: isActive ? 1 : 0.4,
      }} />

      <div style={{
        position: "relative", zIndex: 10,
        height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 24px", overflowY: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: "540px", display: "flex", flexDirection: "column", gap: "22px", paddingTop: "20px", paddingBottom: "40px" }}>

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.6 }}
            style={{ textAlign: "center" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: "var(--primary)",
                boxShadow: "0 0 14px var(--primary-glow)",
              }} />
              <span style={{
                fontFamily: "var(--mono)", fontSize: "11px",
                letterSpacing: "0.45em", color: "var(--muted)",
                textTransform: "uppercase",
              }}>
                Swarm AI
              </span>
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.75 }}
              style={{
                fontFamily: "var(--display)",
                fontSize: "clamp(34px, 5.5vw, 54px)",
                fontWeight: 300,
                lineHeight: 1.15,
                marginBottom: "12px",
              }}
            >
              Describe your situation.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              style={{
                fontFamily: "var(--ui)", fontWeight: 300,
                fontSize: "15px", color: "var(--muted)", lineHeight: 1.7,
              }}
            >
              The more specific you are, the sharper the panel.
            </motion.p>
          </motion.div>

          {/* Main textarea */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.65 }}
            style={{ position: "relative" }}
          >
            <div style={{
              position: "absolute", inset: "-1px",
              borderRadius: "17px",
              background: isListening
                ? "linear-gradient(135deg, rgba(245,166,35,0.7), rgba(245,166,35,0.3))"
                : canLaunch
                ? "linear-gradient(135deg, rgba(123,108,255,0.7), rgba(0,217,255,0.4))"
                : focused
                ? "linear-gradient(135deg, rgba(123,108,255,0.35), rgba(255,255,255,0.1))"
                : "transparent",
              transition: "background 0.4s ease",
              zIndex: 0,
              animation: canLaunch ? "borderGlow 2.5s ease-in-out infinite" : "none",
            }} />
            <textarea
              value={situation}
              onChange={e => { if (!isListening && !isProcessing) setSituation(e.target.value); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={
                isListening   ? "Listening — speak your situation..." :
                isProcessing  ? "Transcribing..." :
                "e.g. MIT CS interview in 3 days — I always freeze on 'why MIT'..."
              }
              rows={4}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && canLaunch) { e.preventDefault(); handleLaunch(); } }}
              style={{
                position: "relative", zIndex: 1,
                width: "100%",
                background: isListening ? "rgba(245,166,35,0.03)" : "rgba(255,255,255,0.025)",
                border: "1px solid transparent",
                borderRadius: "16px",
                padding: "20px 60px 20px 22px",
                fontSize: "15px",
                fontFamily: "var(--ui)",
                fontWeight: 300,
                color: "var(--text)",
                outline: "none",
                resize: "none",
                lineHeight: 1.75,
                backdropFilter: "blur(16px)",
                transition: "background 0.3s",
              }}
            />

            <AnimatePresence>
              {(isListening || isProcessing) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  style={{
                    position: "absolute", top: "14px", right: "14px",
                    display: "flex", alignItems: "center", gap: "6px",
                    background: isListening ? "rgba(245,166,35,0.12)" : "rgba(123,108,255,0.12)",
                    border: `1px solid ${isListening ? "rgba(245,166,35,0.3)" : "rgba(123,108,255,0.3)"}`,
                    borderRadius: "999px", padding: "4px 10px", zIndex: 2,
                  }}
                >
                  <span className="dot" style={{
                    background: isListening ? "var(--amber)" : "var(--primary)",
                    width: "5px", height: "5px",
                  }} />
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: "10px",
                    color: isListening ? "var(--amber)" : "var(--primary)",
                    letterSpacing: "0.06em",
                  }}>
                    {isListening ? "LISTENING" : "TRANSCRIBING"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => isListening ? stop() : start()}
              disabled={isProcessing}
              style={{
                position: "absolute", right: "14px", bottom: "14px",
                width: "40px", height: "40px", borderRadius: "50%",
                border: "1px solid",
                borderColor: isListening ? "rgba(245,166,35,0.5)" : "rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px",
                background: isListening ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.05)",
                color: isListening ? "var(--amber)" : "rgba(255,255,255,0.45)",
                animation: isListening ? "micRing 1.1s ease-out infinite" : "none",
                transition: "all 0.25s",
                zIndex: 2,
              }}
            >
              {isProcessing ? "◌" : isListening ? "■" : "⏺"}
            </button>
          </motion.div>

          {/* Resume context expander */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.38, duration: 0.5 }}
          >
            <button
              onClick={() => setShowContext(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "none", border: "none",
                fontFamily: "var(--mono)", fontSize: "11px",
                color: showContext ? "var(--primary)" : "var(--muted)",
                letterSpacing: "0.1em",
                transition: "color 0.2s",
                paddingLeft: "2px",
              }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: "5px",
                background: showContext ? "rgba(123,108,255,0.18)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${showContext ? "rgba(123,108,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", flexShrink: 0,
                transition: "all 0.2s",
              }}>
                {showContext ? "−" : "+"}
              </span>
              ADD BACKGROUND CONTEXT
              <span style={{ opacity: 0.4, fontSize: "10px" }}>résumé, LinkedIn, role notes…</span>
            </button>

            <AnimatePresence>
              {showContext && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ paddingTop: "10px" }}>
                    <div style={{
                      position: "relative",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "14px",
                      overflow: "hidden",
                    }}>
                      {/* Top edge shine */}
                      <div style={{
                        position: "absolute", top: 0, left: 0, right: 0, height: "1px",
                        background: "linear-gradient(90deg, transparent, rgba(123,108,255,0.3), transparent)",
                      }} />
                      <textarea
                        value={resumeContext}
                        onChange={e => setResumeContext(e.target.value)}
                        placeholder={"Paste your résumé, LinkedIn summary, or any context that helps the panel tailor questions to you specifically.\n\ne.g. 3 years at Google as PM, MBA from Wharton, interviewing for Series B startup…"}
                        rows={5}
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          padding: "16px 20px",
                          fontSize: "13px",
                          fontFamily: "var(--ui)",
                          fontWeight: 300,
                          color: "var(--text-2)",
                          outline: "none",
                          resize: "none",
                          lineHeight: 1.7,
                          display: "block",
                        }}
                      />
                      {resumeContext.trim() && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: "6px",
                          padding: "8px 20px 12px",
                          fontFamily: "var(--mono)", fontSize: "10px",
                          color: "var(--teal)", letterSpacing: "0.08em",
                        }}>
                          <span className="dot" style={{ background: "var(--teal)", width: "5px", height: "5px" }} />
                          Context will be shared with the swarm before your session
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Mic error */}
          <AnimatePresence>
            {micError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  padding: "12px 16px", borderRadius: "12px",
                  background: "rgba(255,95,109,0.07)",
                  border: "1px solid rgba(255,95,109,0.2)",
                  fontFamily: "var(--mono)", fontSize: "11px",
                  color: "var(--coral)", lineHeight: 1.55,
                }}
              >
                {micError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Options row: timed mode */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
          >
            <button
              onClick={() => setTimedMode(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "7px 14px", borderRadius: "999px",
                background: timedMode ? "rgba(245,166,35,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${timedMode ? "rgba(245,166,35,0.4)" : "rgba(255,255,255,0.08)"}`,
                fontFamily: "var(--mono)", fontSize: "10px",
                color: timedMode ? "var(--amber)" : "var(--muted)",
                letterSpacing: "0.09em",
                transition: "all 0.22s",
              }}
            >
              <span style={{ fontSize: "13px" }}>⏱</span>
              TIMED PRESSURE
              {timedMode && (
                <span style={{
                  background: "rgba(245,166,35,0.2)", borderRadius: "999px",
                  padding: "1px 7px", fontSize: "9px", letterSpacing: "0.05em",
                }}>60s</span>
              )}
            </button>
            {timedMode && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", opacity: 0.5 }}
              >
                You'll have 60 s to answer each question
              </motion.span>
            )}
          </motion.div>

          {/* Launch */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.44, duration: 0.6 }}
          >
            <motion.button
              whileHover={canLaunch ? { scale: 1.02 } : {}}
              whileTap={canLaunch ? { scale: 0.98 } : {}}
              className={`btn ${canLaunch ? "btn-primary" : ""}`}
              onClick={handleLaunch}
              disabled={!canLaunch}
              style={{
                opacity: canLaunch ? 1 : 0.28,
                cursor: canLaunch ? "none" : "not-allowed",
                width: "100%",
                background: canLaunch ? undefined : "rgba(255,255,255,0.04)",
                border: canLaunch ? "none" : "1px solid rgba(255,255,255,0.07)",
                color: "white",
                letterSpacing: "0.02em",
                fontSize: "14px",
                position: "relative", overflow: "hidden",
              }}
            >
              {canLaunch && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: "1px",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                }} />
              )}
              {canLaunch ? (
                <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  Launch Swarm
                  {timedMode && <span style={{ opacity: 0.6, fontSize: "12px" }}>· Timed mode on</span>}
                  <span style={{ opacity: 0.7, fontSize: "18px" }}>→</span>
                </span>
              ) : "Describe your situation to begin"}
            </motion.button>
          </motion.div>

          {/* Examples */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.52, duration: 0.7 }}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div style={{
              fontFamily: "var(--mono)", fontSize: "10px",
              color: "rgba(106,103,128,0.5)", letterSpacing: "0.15em",
            }}>
              QUICK EXAMPLES
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setSituation(ex.label)}
                  style={{
                    background: i === exIdx && exVisible ? "rgba(123,108,255,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${i === exIdx && exVisible ? "rgba(123,108,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: "999px",
                    padding: "5px 14px",
                    fontFamily: "var(--mono)", fontSize: "10px",
                    color: i === exIdx && exVisible ? "var(--primary)" : "var(--muted)",
                    letterSpacing: "0.07em",
                    transition: "all 0.35s ease",
                  }}
                >
                  {ex.tag}
                </button>
              ))}
            </div>
            <motion.div
              animate={{ opacity: exVisible ? 0.65 : 0 }}
              transition={{ duration: 0.28 }}
              onClick={() => setSituation(EXAMPLES[exIdx].label)}
              style={{
                fontFamily: "var(--ui)", fontWeight: 300,
                fontSize: "13px", color: "var(--muted)",
                lineHeight: 1.6, cursor: "none",
                paddingLeft: "2px",
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
