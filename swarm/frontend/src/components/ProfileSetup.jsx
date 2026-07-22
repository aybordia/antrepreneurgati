import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getJSON, postJSON } from "../lib/api";

const sv = {
  initial: { opacity: 0, filter: "blur(10px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, filter: "blur(8px)", transition: { duration: 0.3 } },
};

// Each statement is phrased as a neutral self-description, never a deficit.
const TOGGLES = [
  { key: "literal",         text: "I often take things literally.", sub: "Idioms, sarcasm, or hypothetical questions can be confusing." },
  { key: "processingTime",  text: "I need a little more time to think before I answer.", sub: "Interviewers will wait, without rushing or filling the silence." },
  { key: "openEndedHard",   text: "Broad questions are hard to start.", sub: "Like “tell me about yourself.” You'll be offered a concrete place to begin." },
  { key: "shutdown",        text: "Under pressure I sometimes go quiet or blank.", sub: "If that happens, the panel eases off and offers to come back to it." },
  { key: "needsBreaks",     text: "I may need to take a short break.", sub: "You can ask for one anytime and it's welcomed." },
  { key: "wantWritten",     text: "I'd like to see each question in writing.", sub: "Questions will be phrased clearly so they read well on screen." },
  { key: "wantTopicWarning",text: "Please warn me before the topic changes.", sub: "The interviewer will say when they're moving to a new area." },
];

function ToggleRow({ t, on, onToggle }) {
  return (
    <button
      onClick={() => onToggle(t.key)}
      aria-pressed={on}
      className="card"
      style={{
        width: "100%", textAlign: "left", cursor: "pointer",
        display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px",
        borderColor: on ? "rgba(116,185,160,0.5)" : "var(--line)",
        background: on ? "var(--calm-soft)" : "var(--surface)",
        transition: "all 0.18s",
      }}
    >
      <span aria-hidden style={{
        flex: "none", marginTop: 3, width: 22, height: 22, borderRadius: 6,
        border: `2px solid ${on ? "var(--calm)" : "var(--line)"}`,
        background: on ? "var(--calm)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.18s",
      }}>
        {on && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        )}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontFamily: "var(--ui)", fontSize: 18, fontWeight: 500, color: "var(--text)", lineHeight: 1.4 }}>{t.text}</span>
        <span style={{ fontFamily: "var(--ui)", fontSize: 15, fontWeight: 300, color: "var(--dim)", lineHeight: 1.5 }}>{t.sub}</span>
      </span>
    </button>
  );
}

const DETAIL_OPTIONS = [
  { key: "detailed", label: "Give lots of detail" },
  { key: "brief", label: "Keep it short" },
  { key: "", label: "It varies" },
];

const labelStyle = { display: "block", fontFamily: "var(--mono)", fontSize: 14, color: "var(--dim)", letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" };
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken?.();
        const { profile: saved } = await getJSON("/api/profile", token);
        if (!cancelled && saved) setProfile({ ...EMPTY, ...saved });
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

      <div style={{ position: "relative", zIndex: 10, minHeight: "100%", padding: "80px 24px 56px" }}>
        <div style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

          <div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 14, letterSpacing: "0.28em", color: "var(--dim)", textTransform: "uppercase" }}>
              {isFirstTime ? "One-time setup" : "Your profile"}
            </span>
            <h1 style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(38px, 6vw, 56px)", lineHeight: 1.12, margin: "12px 0 10px" }}>
              About how you communicate.
            </h1>
            <p style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 18, color: "var(--dim)", lineHeight: 1.65, maxWidth: 560 }}>
              This shapes how your interviewers and conversations actually behave — so it fits you, not a generic script. It's private, every part is optional, and there are no wrong answers. This is about how <em style={{ fontStyle: "normal", color: "var(--calm)" }}>you</em> communicate, not fixing anything.
            </p>
          </div>

          {loading ? (
            <div style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--dim)", padding: "20px 0" }}>Loading your profile…</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {TOGGLES.map(t => (
                  <ToggleRow key={t.key} t={t} on={profile[t.key]} onToggle={toggle} />
                ))}
              </div>

              {/* Detail style — segmented */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={labelStyle}>When I answer, I tend to</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {DETAIL_OPTIONS.map(o => (
                    <button key={o.key || "varies"} onClick={() => setField("detailStyle", o.key)} aria-pressed={profile.detailStyle === o.key}
                      style={{
                        padding: "10px 18px", borderRadius: 999, cursor: "pointer",
                        background: profile.detailStyle === o.key ? "var(--honey-soft)" : "transparent",
                        border: `1px solid ${profile.detailStyle === o.key ? "rgba(228,163,57,0.5)" : "var(--line)"}`,
                        fontFamily: "var(--ui)", fontSize: 17,
                        color: profile.detailStyle === o.key ? "var(--honey)" : "var(--dim)",
                        transition: "all 0.18s",
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="p-strengths" style={labelStyle}>Things you're great at (optional)</label>
                <textarea id="p-strengths" rows={2} value={profile.strengths} onChange={e => setField("strengths", e.target.value)}
                  placeholder="e.g. deep knowledge of history, precise memory for detail, honesty, a subject you could talk about for hours"
                  style={textStyle} />
                <p style={{ fontFamily: "var(--ui)", fontSize: 14, color: "var(--dim)", marginTop: 6, lineHeight: 1.5 }}>
                  Your interviewers will give you room to show these — they're real advantages.
                </p>
              </div>

              <div>
                <label htmlFor="p-goal" style={labelStyle}>What do you want to get better at? (optional)</label>
                <textarea id="p-goal" rows={2} value={profile.goal} onChange={e => setField("goal", e.target.value)}
                  placeholder="e.g. getting comfortable with “tell me about a weakness”, or not going off on tangents"
                  style={textStyle} />
              </div>

              <div>
                <label htmlFor="p-notes" style={labelStyle}>Anything else your interviewers should know? (optional)</label>
                <textarea id="p-notes" rows={2} value={profile.notes} onChange={e => setField("notes", e.target.value)}
                  placeholder="Anything at all that helps them work with you."
                  style={textStyle} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
                <button className="btn btn-primary" onClick={save} disabled={saving}
                  style={{ height: 52, fontSize: 19, padding: "0 30px", minWidth: 220 }}>
                  {saving ? "Saving…" : isFirstTime ? "Save and continue" : "Save profile"}
                </button>
                {onBack && (
                  <button className="btn btn-ghost" onClick={onBack} style={{ height: 52, fontSize: 18, padding: "0 22px" }}>
                    {isFirstTime ? "Skip for now" : "Back"}
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
