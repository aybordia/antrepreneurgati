import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { getTTSAnalyser } from "../hooks/useVoiceOutput";

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function stripHonorific(name = "") {
  return name.replace(/^(dr\.?|prof\.?|professor)\s+/i, "");
}

function initials(name = "") {
  const parts = stripHonorific(name).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}

/* Amplitude-driven halo: reads the shared TTS analyser each frame and writes
   styles directly to the DOM — no React state per frame. */
function SpeakingHalo({ color, active }) {
  const haloRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const halo = haloRef.current;
    if (!halo) return;
    if (!active || reduceMotion()) {
      halo.style.opacity = active ? "0.35" : "0";
      halo.style.transform = "scale(1.15)";
      return;
    }

    let data = null;
    let smoothed = 0;
    const tick = () => {
      const analyser = getTTSAnalyser();
      let level = 0.25 + 0.1 * Math.sin(performance.now() / 420); // gentle fallback breath
      if (analyser) {
        if (!data || data.length !== analyser.frequencyBinCount) {
          data = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        level = (sum / data.length / 255) * 1.6;
      }
      smoothed = smoothed * 0.8 + level * 0.2;
      const s = 1.1 + smoothed * 0.55;
      halo.style.transform = `scale(${s})`;
      halo.style.opacity = `${Math.min(0.22 + smoothed * 0.7, 0.85)}`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <div
      ref={haloRef}
      aria-hidden
      style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        border: `2px solid ${color}`,
        boxShadow: `0 0 24px ${color}55`,
        opacity: 0,
        pointerEvents: "none",
        transition: "opacity 0.4s ease",
      }}
    />
  );
}

/**
 * The Panel Rail — every persona stays visible for the whole session.
 * The speaking node breathes with real voice amplitude; the others listen.
 * Nothing about the user is ever visualized here.
 */
export default function PanelRail({ personas = [], activeName, speaking }) {
  const n = personas.length;
  return (
    <div role="group" aria-label="Interview panel"
      style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "clamp(18px, 4vw, 40px)" }}>
      {personas.map((p, i) => {
        const isActive = p.name === activeName;
        // Shallow arc: outer nodes sit slightly lower
        const mid = (n - 1) / 2;
        const lift = -Math.round((1 - Math.abs(i - mid) / Math.max(mid, 1)) * 10);
        return (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: lift }}
            transition={{ delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
          >
            <div style={{ position: "relative", width: isActive ? 62 : 46, height: isActive ? 62 : 46, transition: "width 0.4s var(--ease-spring), height 0.4s var(--ease-spring)" }}>
              <SpeakingHalo color={p.color} active={isActive && speaking} />
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isActive ? `${p.color}22` : "var(--surface)",
                border: `1.5px solid ${isActive ? p.color : "var(--line)"}`,
                color: isActive ? p.color : "var(--dim)",
                fontFamily: "var(--display)", fontWeight: 500,
                fontSize: isActive ? 18 : 14,
                transition: "all 0.4s var(--ease-spring)",
              }}>
                {initials(p.name)}
              </div>
            </div>
            <span style={{
              fontFamily: "var(--mono)", fontSize: 15, letterSpacing: "0.04em",
              color: isActive ? p.color : "var(--dim)",
              opacity: isActive ? 1 : 0.65,
              transition: "color 0.3s, opacity 0.3s",
              maxWidth: 86, textAlign: "center",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {stripHonorific(p.name).split(/\s+/)[0]}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * Question rail — always tells the candidate where they are and how much
 * remains. Predictability by design.
 */
export function QuestionRail({ total = 0, current = 0, complete = false }) {
  if (!total) return null;
  const shown = Math.min(complete ? total : current + 1, total);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
      <div style={{ display: "flex", gap: 6, width: "min(320px, 70%)" }}>
        {Array.from({ length: total }).map((_, i) => {
          const done = complete || i < current;
          const now = !complete && i === current;
          return (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: done ? "var(--calm)" : now ? "var(--honey)" : "var(--line)",
              opacity: done ? 0.75 : 1,
              transition: "background 0.5s ease",
            }} />
          );
        })}
      </div>
      <span aria-live="polite" style={{ fontFamily: "var(--mono)", fontSize: 16, color: "var(--dim)", letterSpacing: "0.06em" }}>
        {complete ? "All questions covered" : `Question ${shown} of ${total}`}
      </span>
    </div>
  );
}
