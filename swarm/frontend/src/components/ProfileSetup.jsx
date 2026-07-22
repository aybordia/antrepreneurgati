import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getJSON, postJSON } from "../lib/api";

const sv = {
  initial: { opacity: 0, filter: "blur(10px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, filter: "blur(8px)", transition: { duration: 0.3 } },
};

// Short, plain statements — deliberately few words, large type. No sub-copy.
const TOGGLES = [
  { key: "literal",          text: "I take things literally" },
  { key: "processingTime",   text: "I need time to think" },
  { key: "openEndedHard",    text: "Big open questions are hard" },
  { key: "shutdown",         text: "I can go quiet under pressure" },
  { key: "needsBreaks",      text: "I might need a break" },
  { key: "wantWritten",      text: "Show questions in writing" },
  { key: "wantTopicWarning", text: "Warn me before topic changes" },
];

function ToggleRow({ t, on, onToggle }) {
  return (
    <button
      onClick={() => onToggle(t.key)}
      aria-pressed={on}
      className="card"
      style={{
        width: "100%", textAlign: "left", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 18, padding: "22px 24px",
        borderColor: on ? "rgba(116,185,160,0.55)" : "var(--line)",
        background: on ? "var(--calm-soft)" : "var(--surface)",
        transition: "all 0.16s",
      }}
    >
      <span aria-hidden style={{
        flex: "none", width: 30, height: 30, borderRadius: 8,
        border: `2px solid ${on ? "var(--calm)" : "var(--line)"}`,
        background: on ? "var(--calm)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.16s",
      }}>
        {on && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        )}
      </span>
      <span style={{ fontFamily: "var(--display)", fontSize: "clamp(22px, 3.2vw, 30px)", fontWeight: 500, color: "var(--text)", lineHeight: 1.2 }}>
        {t.text}
      </span>
    </button>
  );
}

const DETAIL_OPTIONS = [
  { key: "detailed", label: "Lots of detail" },
  { key: "brief", label: "Keep it short" },
  { key: "", label: "It varies" },
];

const labelStyle = { display: "block", fontFamily: "var(--mono)", fontSize: 14, color: "var(--dim)", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" };
const textStyle = {
  width: "100%", background: "var(--surface)", border: "1px solid var(--line)",
  borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 17,
  fontFamily: "var(--ui)", fontWeight: 300, color: "var(--text)", outline: "none",
  resize: "none", lineHeight: 1.6,
};

const EMPTY = {
  literal: false, processingTime: false, openEndedHard: false, detailStyle: "",
  shutdown: false, needsBreaks: false, wantWritten: false, wantTopicWarning: false,
  strengths: "", goal: "", notes: "",
};

export default function ProfileSetup({ getIdToken, onDone, onBack, isFirstTime = false }) {
  const [profile, setProfile] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken?.();
        const { profile: saved } = await getJSON("/api/profile", token);
        if (!cancelled && saved) {
          setProfile({ ...EMPTY, ...saved });
          if (saved.strengths || saved.goal || saved.notes) setShowMore(true);
        }
      } catch { /* first-time users have no profile yet — keep EMPTY */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [getIdToken]);

  const toggle = (key) => setProfile(p => ({ ...p, [key]: !p[key] }));
  const setField = (key, value) => setProfile(p => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const token = await getIdToken?.();
      const { profile: saved } = await postJSON("/api/profile", { profile }, token);
      onDone?.(saved || { ...profile, set: true });
    } catch (e) {
      console.error("[profile] save failed:", e.message);
      onDone?.({ ...profile, set: true }); // don't trap the user if the save call hiccups
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="screen screen-scroll" variants={sv} initial="initial" animate="animate" exit="exit" style={{ background: "var(--ink)" }}>
      <div className="ambient" />
      <div className="noise" />

      <div style={{ position: "relative", zIndex: 10, minHeight: "100%", padding: "88px 24px 64px" }}>
        <div style={{ width: "100%", maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>

          <div>
            <h1 style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(44px, 8vw, 72px)", lineHeight: 1.05, margin: "0 0 14px" }}>
              What's true<br />for you?
            </h1>
            <p style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 19, color: "var(--dim)", lineHeight: 1.5 }}>
              Tap any that fit. All optional.
            </p>
          </div>

          {loading ? (
            <div style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--dim)", padding: "20px 0" }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {TOGGLES.map(t => (
                  <ToggleRow key={t.key} t={t} on={profile[t.key]} onToggle={toggle} />
                ))}
              </div>

              {/* Detail style — segmented, short labels */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
                <span style={labelStyle}>My answers are</span>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {DETAIL_OPTIONS.map(o => (
                    <button key={o.key || "varies"} onClick={() => setField("detailStyle", o.key)} aria-pressed={profile.detailStyle === o.key}
                      style={{
                        padding: "12px 22px", borderRadius: 999, cursor: "pointer",
                        background: profile.detailStyle === o.key ? "var(--honey-soft)" : "transparent",
                        border: `1px solid ${profile.detailStyle === o.key ? "rgba(228,163,57,0.5)" : "var(--line)"}`,
                        fontFamily: "var(--ui)", fontSize: 19, fontWeight: 500,
                        color: profile.detailStyle === o.key ? "var(--honey)" : "var(--dim)",
                        transition: "all 0.16s",
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional details, hidden by default so the main page stays sparse */}
              <button onClick={() => setShowMore(v => !v)} aria-expanded={showMore}
                style={{
                  alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer",
                  fontFamily: "var(--mono)", fontSize: 16, letterSpacing: "0.06em",
                  color: showMore ? "var(--honey)" : "var(--dim)", padding: "4px 0", marginTop: 4,
                }}>
                {showMore ? "− Less" : "+ Add strengths & goal (optional)"}
              </button>

              {showMore && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label htmlFor="p-strengths" style={labelStyle}>You're great at</label>
                    <textarea id="p-strengths" rows={2} value={profile.strengths} onChange={e => setField("strengths", e.target.value)}
                      placeholder="e.g. deep knowledge, precise memory, honesty" style={textStyle} />
                  </div>
                  <div>
                    <label htmlFor="p-goal" style={labelStyle}>You want to practise</label>
                    <textarea id="p-goal" rows={2} value={profile.goal} onChange={e => setField("goal", e.target.value)}
                      placeholder="e.g. the “tell me a weakness” question" style={textStyle} />
                  </div>
                  <div>
                    <label htmlFor="p-notes" style={labelStyle}>Anything else</label>
                    <textarea id="p-notes" rows={2} value={profile.notes} onChange={e => setField("notes", e.target.value)}
                      placeholder="Optional." style={textStyle} />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
                <button className="btn btn-primary" onClick={save} disabled={saving}
                  style={{ height: 56, fontSize: 21, padding: "0 34px", minWidth: 220 }}>
                  {saving ? "Saving…" : isFirstTime ? "Continue" : "Save"}
                </button>
                {onBack && (
                  <button className="btn btn-ghost" onClick={onBack} style={{ height: 56, fontSize: 19, padding: "0 24px" }}>
                    {isFirstTime ? "Skip" : "Back"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
