import { motion } from "framer-motion";

function AuroraBlob({ style }) {
  return (
    <div style={{
      position: "absolute", borderRadius: "50%",
      filter: "blur(90px)", pointerEvents: "none",
      ...style,
    }} />
  );
}

export default function WaitlistPending({ user, onSignOut, onJoinWaitlist }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#04040A", overflow: "hidden",
      }}
    >
      <AuroraBlob style={{
        width: "60vw", height: "60vw", top: "-20%", left: "-15%",
        background: "radial-gradient(circle, rgba(123,108,255,0.1) 0%, transparent 70%)",
        animation: "auroraMove 20s ease-in-out infinite",
      }} />
      <AuroraBlob style={{
        width: "45vw", height: "45vw", bottom: "-15%", right: "-10%",
        background: "radial-gradient(circle, rgba(0,217,255,0.07) 0%, transparent 70%)",
        animation: "auroraMove 26s ease-in-out infinite reverse",
      }} />

      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: "440px",
        padding: "0 28px",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>

        {/* Status icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(123,108,255,0.12)",
            border: "1px solid rgba(123,108,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "28px",
            boxShadow: "0 0 40px rgba(123,108,255,0.2)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B6CFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center", marginBottom: "32px" }}
        >
          <h1 style={{
            fontFamily: "var(--display)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 300,
            color: "var(--text)",
            marginBottom: "14px",
            lineHeight: 1.15,
          }}>
            You're on the list
          </h1>
          <p style={{
            fontFamily: "var(--ui)", fontWeight: 300,
            fontSize: "15px", color: "var(--muted)",
            lineHeight: 1.75, maxWidth: "340px",
          }}>
            Your account{user?.email ? <> (<span style={{ color: "var(--text)", opacity: 0.7 }}>{user.email}</span>)</> : ""} is pending approval. We'll reach out as soon as your spot opens up.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.32, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.028)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "24px",
            padding: "28px 28px 24px",
            backdropFilter: "blur(40px) saturate(160%)",
            boxShadow:
              "0 0 0 1px rgba(123,108,255,0.07), " +
              "0 24px 60px rgba(0,0,0,0.45), " +
              "0 1px 0 rgba(255,255,255,0.05) inset",
            display: "flex", flexDirection: "column", gap: "16px",
          }}
        >
          {/* Steps */}
          {[
            { step: "1", label: "Fill out the waitlist form", done: true },
            { step: "2", label: "We review your application", done: false },
            { step: "3", label: "Get your approval email", done: false },
            { step: "4", label: "Sign in and start practising", done: false },
          ].map(({ step, label, done }) => (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: done ? "rgba(77,221,170,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${done ? "rgba(77,221,170,0.4)" : "rgba(255,255,255,0.1)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--mono)", fontSize: "11px",
                color: done ? "#4DDDAA" : "var(--muted)",
              }}>
                {done ? "✓" : step}
              </div>
              <span style={{
                fontFamily: "var(--ui)", fontSize: "13px",
                color: done ? "var(--text)" : "var(--muted)",
                fontWeight: done ? 400 : 300,
              }}>
                {label}
              </span>
            </div>
          ))}

          {/* Divider */}
          <div style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
            margin: "4px 0",
          }} />

          {/* Not on waitlist yet? */}
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "var(--ui)", fontSize: "12px",
              color: "var(--muted)", marginBottom: "12px", opacity: 0.7,
            }}>
              Haven't filled out the form yet?
            </p>
            <button
              onClick={onJoinWaitlist}
              style={{
                width: "100%", padding: "11px 20px",
                borderRadius: "12px",
                border: "1px solid rgba(123,108,255,0.35)",
                background: "rgba(123,108,255,0.1)",
                color: "#a09aff",
                cursor: "pointer",
                fontFamily: "var(--mono)", fontSize: "12px",
                letterSpacing: "0.06em",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(123,108,255,0.18)"; e.currentTarget.style.borderColor = "rgba(123,108,255,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(123,108,255,0.1)"; e.currentTarget.style.borderColor = "rgba(123,108,255,0.35)"; }}
            >
              Join the waitlist
            </button>
          </div>
        </motion.div>

        {/* Sign out */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={{ marginTop: "20px" }}
        >
          <button
            onClick={onSignOut}
            style={{
              padding: "6px 16px", borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "var(--muted)", cursor: "pointer",
              fontFamily: "var(--mono)", fontSize: "11px",
              letterSpacing: "0.04em", opacity: 0.5,
              transition: "all 0.18s",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
          >
            Sign out
          </button>
        </motion.div>

        <div style={{ height: 40 }} />
      </div>
    </motion.div>
  );
}
