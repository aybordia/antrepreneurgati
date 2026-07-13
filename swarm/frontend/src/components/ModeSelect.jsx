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
        padding: "72px 32px 40px", maxWidth: 1280, margin: "0 auto", gap: 40, width: "100%",
      }}>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
          style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(52px, 8vw, 88px)", lineHeight: 1.1, textAlign: "center" }}>
          Practice.
        </motion.h1>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20, width: "100%", flex: 1, maxHeight: 560,
        }}>
          {MODES.map((m, i) => (
            <motion.button
              key={m.key}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(m.key)}
              className="card"
              style={{
                padding: "24px", cursor: "pointer",
                minHeight: "min(48vh, 460px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderTop: `4px solid ${m.accent}`,
                background: "var(--surface)",
              }}
            >
              <span style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: "clamp(40px, 4.5vw, 62px)", color: "var(--text)" }}>
                {m.title}
              </span>
            </motion.button>
          ))}
        </div>

        <button className="btn btn-ghost" onClick={onBack} style={{ fontSize: 18 }}>
          Back
        </button>
      </div>
    </motion.div>
  );
}
