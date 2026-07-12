import { motion } from "framer-motion";

const sv = {
  initial: { opacity: 0, filter: "blur(10px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, filter: "blur(8px)", transition: { duration: 0.3 } },
};

const MODES = [
  { key: "interview", accent: "var(--honey)", title: "Interview" },
  { key: "conversation", accent: "var(--calm)", title: "Casual" },
  { key: "peer", accent: "#8FB6E8", title: "Person" },
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
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
          style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(38px, 6vw, 56px)", lineHeight: 1.15, textAlign: "center" }}>
          Practice.
        </motion.h1>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14, width: "100%",
        }}>
          {MODES.map((m, i) => (
            <motion.button
              key={m.key}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(m.key)}
              className="card"
              style={{
                padding: "48px 22px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderTop: `3px solid ${m.accent}`,
                background: "var(--surface)",
              }}
            >
              <span style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 34, color: "var(--text)" }}>
                {m.title}
              </span>
            </motion.button>
          ))}
        </div>

        <button className="btn btn-ghost" onClick={onBack} style={{ fontSize: 17 }}>
          Back
        </button>
      </div>
    </motion.div>
  );
}
