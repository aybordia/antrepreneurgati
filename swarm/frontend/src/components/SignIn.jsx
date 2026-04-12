import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/* ── Floating aurora blobs ── */
function AuroraBlob({ style }) {
  return (
    <div style={{
      position: "absolute", borderRadius: "50%",
      filter: "blur(90px)", pointerEvents: "none",
      ...style,
    }} />
  );
}

/* ── Animated logo mark ── */
function LogoMark() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
      style={{ display: "block", filter: "drop-shadow(0 0 14px rgba(123,108,255,0.55))" }}>
      {/* Outer ring */}
      <circle cx="24" cy="24" r="22" stroke="rgba(123,108,255,0.25)" strokeWidth="1" />
      {/* Spinning dashed ring */}
      <circle cx="24" cy="24" r="22" stroke="rgba(123,108,255,0.55)" strokeWidth="1.5"
        strokeDasharray="8 6" style={{ animation: "rotateSlow 12s linear infinite", transformOrigin: "24px 24px" }} />
      {/* Three nodes */}
      {[
        { cx: 24, cy: 10, r: 3.5, color: "#7B6CFF" },
        { cx: 38, cy: 34, r: 3.5, color: "#00D9FF" },
        { cx: 10, cy: 34, r: 3.5, color: "#4DDDAA" },
      ].map(({ cx, cy, r, color }, i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r + 4} fill={`${color}18`} />
          <circle cx={cx} cy={cy} r={r} fill={color} />
        </g>
      ))}
      {/* Connecting lines */}
      <line x1="24" y1="10" x2="38" y2="34" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <line x1="38" y1="34" x2="10" y2="34" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <line x1="10" y1="34" x2="24" y2="10" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {/* Center dot */}
      <circle cx="24" cy="26" r="3" fill="white" opacity="0.9" />
    </svg>
  );
}

/* ── Feature row item ── */
function Feature({ icon, title, desc, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex", alignItems: "flex-start", gap: "14px",
        padding: "14px 16px",
        background: "rgba(255,255,255,0.022)",
        border: "1px solid rgba(255,255,255,0.055)",
        borderRadius: "14px",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: "10px", flexShrink: 0,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "16px",
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontFamily: "var(--ui)", fontWeight: 500, fontSize: "13px",
          color: "var(--text)", marginBottom: "3px", letterSpacing: "0.01em",
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: "var(--ui)", fontWeight: 300, fontSize: "12px",
          color: "var(--muted)", lineHeight: 1.55,
        }}>
          {desc}
        </div>
      </div>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#04040A", overflow: "hidden",
      }}
    >
      {/* Aurora blobs */}
      <AuroraBlob style={{
        width: "70vw", height: "70vw", top: "-25%", left: "-20%",
        background: "radial-gradient(circle, rgba(123,108,255,0.13) 0%, transparent 70%)",
        animation: "auroraMove 20s ease-in-out infinite",
      }} />
      <AuroraBlob style={{
        width: "55vw", height: "55vw", bottom: "-18%", right: "-15%",
        background: "radial-gradient(circle, rgba(0,217,255,0.09) 0%, transparent 70%)",
        animation: "auroraMove 26s ease-in-out infinite reverse",
      }} />
      <AuroraBlob style={{
        width: "40vw", height: "40vw", top: "50%", left: "58%",
        background: "radial-gradient(circle, rgba(77,221,170,0.07) 0%, transparent 70%)",
        animation: "auroraMove 22s ease-in-out infinite 6s",
      }} />

      {/* Grid lines */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), " +
          "linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 90% 90% at 50% 50%, black 20%, transparent 100%)",
      }} />
      <div className="noise" />

      {/* ── Main content ── */}
      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: "460px",
        padding: "0 28px",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>

        {/* Logo mark + wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: "14px", marginBottom: "36px",
          }}
        >
          <LogoMark />
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <div style={{
              width: 1, height: 16,
              background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.2), transparent)",
            }} />
            <span style={{
              fontFamily: "var(--mono)", fontSize: "11px",
              letterSpacing: "0.45em", color: "var(--muted)",
              textTransform: "uppercase",
            }}>
              Swarm AI
            </span>
            <div style={{
              width: 1, height: 16,
              background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.2), transparent)",
            }} />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "var(--display)",
            fontSize: "clamp(40px, 6.5vw, 62px)",
            fontWeight: 300,
            lineHeight: 1.08,
            color: "var(--text)",
            textAlign: "center",
            marginBottom: "16px",
          }}
        >
          Your AI panel.
          <br />
          <em style={{
            fontStyle: "italic",
            background: "linear-gradient(135deg, #7B6CFF 0%, #00D9FF 60%, #4DDDAA 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Ruthlessly honest.
          </em>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.42, duration: 0.7 }}
          style={{
            fontFamily: "var(--ui)", fontWeight: 300,
            fontSize: "15px", color: "var(--muted)",
            lineHeight: 1.75, textAlign: "center",
            marginBottom: "36px", maxWidth: "360px",
          }}
        >
          Five specialized AI agents study your role, your company, and your background — then interview you live. No fluff. No filler. Just the questions that actually matter.
        </motion.p>

        {/* Feature highlights */}
        <div style={{
          width: "100%", display: "flex", flexDirection: "column", gap: "8px",
          marginBottom: "28px",
        }}>
          <Feature
            icon="🎙"
            title="Live voice interviews"
            desc="Speak naturally. The panel adapts in real time based on your answers."
            color="#7B6CFF"
            delay={0.52}
          />
          <Feature
            icon="🔬"
            title="Deep-researched questions"
            desc="Five agents spend time on your exact company, role, and résumé before you even start."
            color="#00D9FF"
            delay={0.60}
          />
          <Feature
            icon="📋"
            title="Scored debrief"
            desc="Every session ends with an honest score, your strongest moments, and what to fix next."
            color="#4DDDAA"
            delay={0.68}
          />
        </div>

        {/* Sign-in card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.72, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.028)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "24px",
            padding: "32px 32px 28px",
            backdropFilter: "blur(40px) saturate(160%)",
            boxShadow:
              "0 0 0 1px rgba(123,108,255,0.08), " +
              "0 32px 80px rgba(0,0,0,0.5), " +
              "0 1px 0 rgba(255,255,255,0.06) inset",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
          }}
        >
          {/* Card headline */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "var(--display)", fontSize: "21px",
              fontWeight: 300, letterSpacing: "0.01em",
              marginBottom: "7px", color: "var(--text)",
            }}>
              Ready to be challenged?
            </div>
            <div style={{
              fontFamily: "var(--ui)", fontSize: "13px",
              color: "var(--muted)", lineHeight: 1.65,
            }}>
              Sign in with Google to start your first session.
              <br />
              <span style={{ opacity: 0.65 }}>Your data stays private — Google is only used to verify you.</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{
            width: "100%", height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
          }} />

          {/* Google button */}
          <div ref={btnRef} style={{ width: "100%" }} />

          {!googleReady && (
            <div style={{
              fontFamily: "var(--mono)", fontSize: "11px",
              color: "var(--muted)", opacity: 0.4,
              letterSpacing: "0.06em",
            }}>
              Loading…
            </div>
          )}

          {/* Trust badges */}
          <div style={{
            display: "flex", gap: "20px", alignItems: "center",
            justifyContent: "center",
          }}>
            {[
              { icon: "🔒", label: "Private" },
              { icon: "⚡", label: "Instant setup" },
              { icon: "✦", label: "No credit card" },
            ].map(({ icon, label }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: "5px",
              }}>
                <span style={{ fontSize: "11px", opacity: 0.55 }}>{icon}</span>
                <span style={{
                  fontFamily: "var(--mono)", fontSize: "10px",
                  color: "var(--muted)", opacity: 0.45,
                  letterSpacing: "0.06em",
                }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bottom spacer */}
        <div style={{ height: 40 }} />
      </div>
    </motion.div>
  );
}
