import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/* Minimal line icons (stroked, on-brand) — no emoji */
const ICONS = {
  voice: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  research: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5",
  debrief: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
};

function LineIcon({ path, color }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function Feature({ iconPath, title, desc, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14, padding: "15px 17px",
        background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <LineIcon path={iconPath} color={color} />
      </div>
      <div>
        <div style={{ fontFamily: "var(--ui)", fontWeight: 500, fontSize: 18, color: "var(--text)", marginBottom: 3 }}>{title}</div>
        <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 16, color: "var(--dim)", lineHeight: 1.55 }}>{desc}</div>
      </div>
    </motion.div>
  );
}

const TYPEFORM_URL = "https://form.typeform.com/to/pVmDViYF";

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
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", background: "var(--ink)", overflowY: "auto", overflowX: "hidden" }}
    >
      {/* One calm honey pool — quiet, on-brand */}
      <div style={{
        position: "absolute", width: "60vw", height: "60vw", top: "-22%", left: "-15%",
        borderRadius: "50%", filter: "blur(100px)", pointerEvents: "none",
        background: "radial-gradient(circle, color-mix(in srgb, var(--honey) 9%, transparent) 0%, transparent 70%)",
      }} />
      <div style={{
        position: "absolute", width: "48vw", height: "48vw", bottom: "-16%", right: "-12%",
        borderRadius: "50%", filter: "blur(100px)", pointerEvents: "none",
        background: "radial-gradient(circle, color-mix(in srgb, var(--calm) 8%, transparent) 0%, transparent 70%)",
      }} />
      <div className="noise" />

      <div style={{
        position: "relative", zIndex: 10, width: "100%", maxWidth: 520,
        padding: "48px 28px 64px", margin: "auto",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>

        {/* Logo + wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 34 }}
        >
          <img src="/logo.png" alt="Swarm AI logo" width={104} height={104} style={{ display: "block" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 15, letterSpacing: "0.45em", color: "var(--dim)", textTransform: "uppercase" }}>
            Swarm AI
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontFamily: "var(--display)", fontSize: "clamp(46px, 7vw, 70px)", fontWeight: 400, lineHeight: 1.08, color: "var(--text)", textAlign: "center", marginBottom: 18 }}
        >
          Interview practice
          <br />
          <span style={{
            background: "linear-gradient(120deg, var(--honey) 0%, var(--calm) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            built for you.
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.7 }}
          style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 19, color: "var(--dim)", lineHeight: 1.7, textAlign: "center", marginBottom: 34, maxWidth: 400 }}
        >
          Made for autistic people. Clear, literal questions. Your pace, no timers, no judgment of how you speak or move. A private, non-scored debrief afterward.
        </motion.p>

        {/* Features */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          <Feature iconPath={ICONS.voice} title="Live voice interviews" desc="Speak naturally. The panel adapts to what you actually say." color="var(--honey)" delay={0.5} />
          <Feature iconPath={ICONS.research} title="Questions tuned to you" desc="Built around your exact role, program, and how you communicate." color="var(--calm)" delay={0.58} />
          <Feature iconPath={ICONS.debrief} title="A private, non-scored debrief" desc="Written impressions and your full transcript. Observations, never grades." color="var(--honey)" delay={0.66} />
        </div>

        {/* Sign-in card */}
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="card"
          style={{ width: "100%", borderRadius: 22, padding: "30px 32px 26px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, background: "var(--surface)" }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 26, fontWeight: 500, marginBottom: 7, color: "var(--text)" }}>
              Start when you're ready.
            </div>
            <div style={{ fontFamily: "var(--ui)", fontSize: 17, color: "var(--dim)", lineHeight: 1.6 }}>
              Sign in with Google to begin.<br />
              <span style={{ opacity: 0.75 }}>Private — Google only confirms it's you.</span>
            </div>
          </div>

          <div style={{ width: "100%", height: 1, background: "var(--line)" }} />

          <div ref={btnRef} style={{ width: "100%" }} />
          {!googleReady && (
            <div style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--dim)", letterSpacing: "0.06em" }}>Loading…</div>
          )}

          <div style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--dim)", letterSpacing: "0.08em" }}>
            Private · Free to start
          </div>

          <div style={{ width: "100%", height: 1, background: "var(--line)" }} />

          <a
            href={TYPEFORM_URL} target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              padding: "12px 16px", borderRadius: 12,
              border: "1px solid color-mix(in srgb, var(--honey) 25%, transparent)",
              background: "var(--honey-soft)", textDecoration: "none", transition: "border-color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "color-mix(in srgb, var(--honey) 55%, transparent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "color-mix(in srgb, var(--honey) 25%, transparent)"; }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--honey)", letterSpacing: "0.06em" }}>JOIN OUR COMMUNITY</div>
              <div style={{ fontFamily: "var(--ui)", fontSize: 15, color: "var(--dim)", marginTop: 1 }}>Stay in the loop as we build</div>
            </div>
            <span aria-hidden style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 16, color: "var(--honey)" }}>→</span>
          </a>
        </motion.div>

        <div style={{ height: 40 }} />
      </div>
    </motion.div>
  );
}
