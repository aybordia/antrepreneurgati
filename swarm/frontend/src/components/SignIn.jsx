import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import ParticleField from "./ParticleField";

const sv = {
  initial: { opacity: 0, scale: 0.97, filter: "blur(12px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

export default function SignIn({ googleReady, onCredential }) {
  const btnRef = useRef(null);

  // Use renderButton (popup mode) — works without third-party cookies
  useEffect(() => {
    if (!googleReady || !btnRef.current || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: onCredential,
      ux_mode: "popup",
    });

    window.google.accounts.id.renderButton(btnRef.current, {
      theme: "filled_black",
      size: "large",
      width: btnRef.current.offsetWidth || 368,
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
    });
  }, [googleReady, onCredential]);

  return (
    <motion.div
      variants={sv} initial="initial" animate="animate"
      style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#07070A",
      }}
    >
      <div className="ambient" />
      <ParticleField amplitude={0} />

      {/* Grid lines */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(123,108,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(123,108,255,0.03) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
      }} />

      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: "440px",
        padding: "0 24px",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>

        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: "44px" }}
        >
          <div style={{ fontFamily: "var(--mono)", fontSize: "12px", letterSpacing: "0.5em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "18px" }}>
            ⬡ SWARM
          </div>
          <h1 style={{ fontFamily: "var(--display)", fontSize: "clamp(36px,6vw,52px)", fontWeight: 400, lineHeight: 1.15, color: "var(--text)", marginBottom: "14px" }}>
            Prepare for what's<br /><em style={{ color: "var(--primary)" }}>actually</em> coming.
          </h1>
          <p style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "15px", color: "var(--muted)", lineHeight: 1.7 }}>
            Five AI agents build a live interview panel tailored<br />to your exact situation.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="card"
          style={{
            width: "100%", padding: "36px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "22px",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--display)", fontSize: "20px", marginBottom: "8px" }}>
              Sign in to continue
            </div>
            <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>
              Your session data is stored locally.<br />We only use Google to verify your identity.
            </div>
          </div>

          {/* Google renders its button into this div */}
          <div ref={btnRef} style={{ width: "100%" }} />

          {!googleReady && (
            <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", opacity: 0.5 }}>
              Loading...
            </div>
          )}

          <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", opacity: 0.45, letterSpacing: "0.04em" }}>
            No account creation required
          </div>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.38, duration: 0.6 }}
          style={{ display: "flex", gap: "10px", marginTop: "24px", flexWrap: "wrap", justifyContent: "center" }}
        >
          {["Real voice sessions", "5 AI agents", "Live debrief"].map(label => (
            <div key={label} style={{
              fontFamily: "var(--mono)", fontSize: "10px",
              color: "var(--muted)", letterSpacing: "0.06em",
              padding: "5px 12px", borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
            }}>
              {label}
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
