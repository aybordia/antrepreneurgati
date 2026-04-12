import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const sv = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } },
};

function AuroraBlob({ style }) {
  return (
    <div style={{
      position: "absolute",
      borderRadius: "50%",
      filter: "blur(80px)",
      pointerEvents: "none",
      ...style,
    }} />
  );
}

export default function SignIn({ googleReady, onCredential }) {
  const btnRef = useRef(null);

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
      width: btnRef.current.offsetWidth || 340,
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
    });
  }, [googleReady, onCredential]);

  return (
    <motion.div variants={sv} initial="initial" animate="animate"
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#04040A", overflow: "hidden",
      }}
    >
      {/* Aurora blobs */}
      <AuroraBlob style={{
        width: "65vw", height: "65vw",
        top: "-20%", left: "-18%",
        background: "radial-gradient(circle, rgba(123,108,255,0.16) 0%, transparent 70%)",
        animation: "auroraMove 18s ease-in-out infinite",
      }} />
      <AuroraBlob style={{
        width: "50vw", height: "50vw",
        bottom: "-15%", right: "-12%",
        background: "radial-gradient(circle, rgba(0,217,255,0.10) 0%, transparent 70%)",
        animation: "auroraMove 24s ease-in-out infinite reverse",
      }} />
      <AuroraBlob style={{
        width: "35vw", height: "35vw",
        top: "55%", left: "55%",
        background: "radial-gradient(circle, rgba(245,166,35,0.07) 0%, transparent 70%)",
        animation: "auroraMove 20s ease-in-out infinite 4s",
      }} />

      {/* Grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), " +
          "linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
      }} />

      {/* Noise */}
      <div className="noise" />

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: "420px",
        padding: "0 28px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "0",
      }}>

        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            marginBottom: "28px",
          }}
        >
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--primary)",
            boxShadow: "0 0 12px var(--primary-glow)",
            animation: "dotPulse 2s ease-in-out infinite",
          }} />
          <span style={{
            fontFamily: "var(--mono)", fontSize: "11px",
            letterSpacing: "0.4em", color: "var(--muted)",
            textTransform: "uppercase",
          }}>
            Swarm AI
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "var(--display)",
            fontSize: "clamp(44px, 7vw, 66px)",
            fontWeight: 300,
            lineHeight: 1.1,
            color: "var(--text)",
            textAlign: "center",
            marginBottom: "18px",
          }}
        >
          Prepare for what's
          <br />
          <em style={{
            fontStyle: "italic",
            background: "linear-gradient(135deg, #7B6CFF 0%, #00D9FF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            actually
          </em>
          {" "}coming.
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.48, duration: 0.7 }}
          style={{
            fontFamily: "var(--ui)", fontWeight: 300,
            fontSize: "15px", color: "var(--muted)",
            lineHeight: 1.75, textAlign: "center",
            marginBottom: "44px", maxWidth: "340px",
          }}
        >
          Five AI agents research your exact situation and build a live interview panel — tailored to you.
        </motion.p>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.55, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "24px",
            padding: "36px",
            backdropFilter: "blur(32px)",
            boxShadow: "0 32px 64px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05) inset",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "24px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "var(--display)", fontSize: "22px",
              fontWeight: 300, marginBottom: "8px",
            }}>
              Sign in to continue
            </div>
            <div style={{
              fontFamily: "var(--ui)", fontSize: "13px",
              color: "var(--muted)", lineHeight: 1.65,
            }}>
              Your data stays private. Google is only used<br />to verify your identity.
            </div>
          </div>

          <div ref={btnRef} style={{ width: "100%" }} />

          {!googleReady && (
            <div style={{
              fontFamily: "var(--mono)", fontSize: "11px",
              color: "var(--muted)", opacity: 0.45,
              letterSpacing: "0.06em",
            }}>
              Loading...
            </div>
          )}

          <div style={{
            fontFamily: "var(--mono)", fontSize: "10px",
            color: "var(--muted)", opacity: 0.35,
            letterSpacing: "0.06em",
          }}>
            No account creation required
          </div>
        </motion.div>

        {/* Pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.72, duration: 0.6 }}
          style={{
            display: "flex", gap: "8px", marginTop: "24px",
            flexWrap: "wrap", justifyContent: "center",
          }}
        >
          {[
            { label: "Real voice sessions", color: "var(--primary)" },
            { label: "5 AI agents", color: "var(--cyan)" },
            { label: "Live debrief", color: "var(--teal)" },
          ].map(({ label, color }) => (
            <div key={label} className="tag" style={{ color, borderColor: `${color}28` }}>
              {label}
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
