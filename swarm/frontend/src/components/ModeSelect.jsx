import { motion } from "framer-motion";

const sv = {
  initial: { opacity: 0, filter: "blur(10px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, filter: "blur(8px)", transition: { duration: 0.3 } },
};

const MODES = [
  {
    key: "interview",
    accent: "var(--honey)",
    accentSoft: "var(--honey-soft)",
    title: "Interview practice",
    body: "A structured mock interview with a panel of fictional AI interviewers, planned questions, and a private debrief afterward.",
    label: "PRACTICE WITH AI",
  },
  {
    key: "conversation",
    accent: "var(--calm)",
    accentSoft: "var(--calm-soft)",
    title: "Conversation practice",
    body: "Relaxed, open-ended chat with one friendly AI partner. No questions to get through, no evaluation. Just practice talking.",
    label: "PRACTICE WITH AI",
  },
  {
    key: "peer",
    accent: "#8FB6E8",
    accentSoft: "rgba(143,182,232,0.12)",
    title: "Practice with a person",
    body: "A live session with another real person on Swarm. Opt-in only, camera and mic each optional, report and block always one tap away.",
    label: "PRACTICE WITH A REAL PERSON",
  },
];

export default function ModeSelect({ onSelect, onBack }) {
  return (
    <motion.div className="screen screen-scroll" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "var(--ink)" }}>
      <div className="ambient" />
      <div className="noise" />

      <div style={{
        position: "relative", zIndex: 1, minHeight: "100%",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "80px 24px 48px", maxWidth: 880, margin: "0 auto", gap: 28,
      }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
          style={{ textAlign: "center", maxWidth: 520 }}>
          <h1 style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(32px, 5vw, 46px)", lineHeight: 1.15, marginBottom: 10 }}>
            How do you want to practice today?
          </h1>
          <p style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 17, color: "var(--dim)", lineHeight: 1.7 }}>
            Three different spaces. You can switch any time.
          </p>
        </motion.div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14, width: "100%",
        }}>
          {MODES.map((m, i) => (
            <motion.button
              key={m.key}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(m.key)}
              className="card"
              style={{
                padding: "24px 22px 22px", textAlign: "left", cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 10,
                borderTop: `2px solid ${m.accent}`,
                background: "var(--surface)",
                transition: "border-color 0.2s",
                minHeight: 190,
              }}
            >
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: m.accent, letterSpacing: "0.14em" }}>
                {m.label}
              </span>
              <span style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 22, color: "var(--text)" }}>
                {m.title}
              </span>
              <span style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 15.5, color: "var(--dim)", lineHeight: 1.65 }}>
                {m.body}
              </span>
              <span style={{
                marginTop: "auto", paddingTop: 8,
                fontFamily: "var(--mono)", fontSize: 13.5, color: m.accent, letterSpacing: "0.05em",
              }}>
                Choose →
              </span>
            </motion.button>
          ))}
        </div>

        <button className="btn btn-ghost" onClick={onBack} style={{ fontSize: 14.5 }}>
          Back to dashboard
        </button>
      </div>
    </motion.div>
  );
}
