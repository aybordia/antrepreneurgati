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

export default function WaitlistPage({ onBack }) {
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
        background: "radial-gradient(circle, rgba(123,108,255,0.12) 0%, transparent 70%)",
        animation: "auroraMove 20s ease-in-out infinite",
      }} />
      <AuroraBlob style={{
        width: "45vw", height: "45vw", bottom: "-15%", right: "-10%",
        background: "radial-gradient(circle, rgba(0,217,255,0.08) 0%, transparent 70%)",
        animation: "auroraMove 26s ease-in-out infinite reverse",
      }} />

      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: "560px",
        padding: "0 28px",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              alignSelf: "flex-start", marginBottom: "28px",
              padding: "6px 14px", borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--muted)", cursor: "pointer",
              fontFamily: "var(--mono)", fontSize: "11px",
              letterSpacing: "0.04em", transition: "all 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--muted)"; }}
          >
            ← Back
          </button>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center", marginBottom: "32px" }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "5px 14px", borderRadius: "100px",
            background: "rgba(123,108,255,0.12)",
            border: "1px solid rgba(123,108,255,0.25)",
            marginBottom: "20px",
          }}>
            <span style={{ fontSize: "10px", color: "#7B6CFF", letterSpacing: "0.12em", fontFamily: "var(--mono)", textTransform: "uppercase" }}>
              Early Access
            </span>
          </div>

          <h1 style={{
            fontFamily: "var(--display)",
            fontSize: "clamp(32px, 5vw, 50px)",
            fontWeight: 300,
            lineHeight: 1.1,
            color: "var(--text)",
            marginBottom: "14px",
          }}>
            Join the waitlist
          </h1>
          <p style={{
            fontFamily: "var(--ui)", fontWeight: 300,
            fontSize: "15px", color: "var(--muted)",
            lineHeight: 1.75, maxWidth: "380px",
          }}>
            Swarm AI is invite-only while we're in early access. Fill out the form below and we'll reach out when your spot is ready.
          </p>
        </motion.div>

        {/* Typeform embed card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.028)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "24px",
            padding: "32px",
            backdropFilter: "blur(40px) saturate(160%)",
            boxShadow:
              "0 0 0 1px rgba(123,108,255,0.08), " +
              "0 32px 80px rgba(0,0,0,0.5), " +
              "0 1px 0 rgba(255,255,255,0.06) inset",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "24px",
          }}
        >
          {/* Typeform iframe */}
          <div style={{ width: "100%", borderRadius: "14px", overflow: "hidden" }}>
            <iframe
              src="https://form.typeform.com/to/pVmDViYF"
              style={{
                width: "100%",
                height: "480px",
                border: "none",
                borderRadius: "14px",
              }}
              allow="camera; microphone; autoplay; encrypted-media;"
              title="Swarm AI Waitlist"
            />
          </div>

          {/* Divider */}
          <div style={{
            width: "100%", height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
          }} />

          {/* Bottom note */}
          <div style={{
            textAlign: "center",
            fontFamily: "var(--ui)", fontSize: "12px",
            color: "var(--muted)", lineHeight: 1.7, opacity: 0.6,
          }}>
            After submitting, you'll receive an email when your account is approved.
            <br />
            Then sign in with the same Google account you registered with.
          </div>
        </motion.div>

        <div style={{ height: 48 }} />
      </div>
    </motion.div>
  );
}
