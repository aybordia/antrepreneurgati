import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { postJSON } from "../lib/api";
import { speakText, stopAllAudio } from "../hooks/useVoiceOutput";
import { saveSession } from "../lib/localSessions";

const ADAM = "pNInz6obpgDQGcFmaJgB";

const sv = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, transition: { duration: 0.35 } },
};

function buildScript(d) {
  return [
    `Your clarity score is ${d.clarityScore} out of 100. ${d.clarityRationale}`,
    d.bestMoment?.quote ? `Your strongest moment: "${d.bestMoment.quote}". ${d.bestMoment.reason}` : "",
    d.worstMoment?.quote ? `Your most critical stumble: "${d.worstMoment.quote}". ${d.worstMoment.reason}` : "",
    d.contentGaps?.length > 0 ? `Content gaps to address: ${d.contentGaps.slice(0,2).map(g => g.gap).join(". ")}.` : "",
    `The one thing that matters most: ${d.priorityFix}`,
    d.overallVerdict,
    "The swarm has done its job.",
  ].filter(Boolean).join(" ");
}

function scoreColor(s) {
  if (s >= 75) return "#c8f064";
  if (s >= 60) return "#7B6CFF";
  return "#FF6B6B";
}

/* ── Star rating ── */
function StarRating({ label, value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.14em" }}>{label}</div>
      <div style={{ display: "flex", gap: "6px" }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
            style={{
              background: "none", border: "none", padding: "2px",
              fontSize: "22px", lineHeight: 1,
              color: n <= (hovered || value) ? "#F5A623" : "rgba(255,255,255,0.12)",
              transition: "color 0.12s, transform 0.1s",
              transform: n <= (hovered || value) ? "scale(1.2)" : "scale(1)",
            }}
          >★</button>
        ))}
      </div>
    </div>
  );
}

/* ── Score ring ── */
function ScoreRing({ score, color }) {
  const r = 64;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * score) / 100;
  return (
    <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: -6, borderRadius: "50%",
        boxShadow: `0 0 40px ${color}22, 0 0 80px ${color}0a`,
        pointerEvents: "none",
      }} />
      <svg width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <motion.circle cx="80" cy="80" r={r} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          fontFamily: "var(--display)", fontSize: "48px",
          color, lineHeight: 1,
          textShadow: `0 0 30px ${color}55`,
        }}>{score}</div>
      </div>
    </div>
  );
}

export default function Debrief({ sessionResult, situation, onRunAgain, onAskSwarm, getIdToken }) {
  const [debrief, setDebrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedSessionId, setSavedSessionId] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef(null);

  const [showTranscript, setShowTranscript] = useState(false);
  const [interviewRating, setInterviewRating] = useState(0);
  const [debriefRating, setDebriefRating] = useState(0);
  const [interviewFeedback, setInterviewFeedback] = useState("");
  const [debriefFeedback, setDebriefFeedback] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Stop audio on unmount
  useEffect(() => {
    return () => { stopAllAudio(); };
  }, []);

  // Load debrief
  useEffect(() => {
    let cancelled = false;

    // Decode userId once — used in both success and fallback paths
    async function getUserId() {
      try {
        const token = getIdToken ? await getIdToken() : null;
        if (!token) return "anonymous";
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        return payload.sub || "anonymous";
      } catch { return "anonymous"; }
    }

    async function persistSession(debrief, token, userId) {
      const sessionPayload = {
        situation,
        history: sessionResult?.history || [],
        debrief,
        sessionData: sessionResult?.sessionData || {},
      };
      // Always save locally first
      try {
        const local = saveSession(userId, sessionPayload);
        setSavedSessionId(local.id);
      } catch {}
      // Also push to MongoDB (best-effort)
      try {
        const saved = await postJSON("/api/sessions/save", sessionPayload, token);
        if (saved?.id) setSavedSessionId(saved.id);
      } catch {}
    }

    const load = async () => {
      const token = getIdToken ? await getIdToken() : undefined;
      const userId = await getUserId();
      let d;
      try {
        d = await postJSON("/api/debrief", {
          fullTranscript: sessionResult?.history || [],
          situation,
          agentResearch: sessionResult?.sessionData?.agentResearch || {},
          sessionPlan: sessionResult?.sessionData?.sessionPlan || {},
        }, token);
      } catch {
        // Compute a basic score from transcript so we never show hardcoded garbage
        const turns = sessionResult?.history || [];
        const userTurns = turns.filter(t => t.speaker === "You" || t.speaker === "User");
        const avgWords = userTurns.length
          ? Math.round(userTurns.reduce((s, t) => s + (t.text || "").split(/\s+/).filter(Boolean).length, 0) / userTurns.length)
          : 0;
        const computedScore = Math.min(95, Math.max(40, 50 + Math.min(avgWords, 45)));
        d = {
          clarityScore: computedScore,
          clarityRationale: "Score estimated from response length — full analysis temporarily unavailable due to high demand. Try again in a moment.",
          contentGaps: [],
          patterns: [],
          overallVerdict: "Full debrief analysis could not be loaded right now (the AI service is temporarily rate-limited). Your session was saved. Retry in 30 seconds for a complete breakdown.",
          priorityFix: "Retry the debrief in 30 seconds for your full analysis.",
          bestMoment: null,
          worstMoment: null,
        };
      }
      if (!cancelled) {
        setDebrief(d);
        setLoading(false);
        persistSession(d, token, userId);
      }
    };

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSpeak = async () => {
    if (isSpeaking) {
      stopAllAudio();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    try {
      const script = buildScript(debrief);
      const audio = await speakText({ text: script, voiceId: ADAM, stability: 0.42, similarityBoost: 0.82 });
      if (audio) {
        currentAudioRef.current = audio;
        await new Promise(res => { audio.onended = res; audio.onerror = res; audio.play().catch(res); });
        currentAudioRef.current = null;
      }
    } catch {}
    setIsSpeaking(false);
  };

  const color = debrief ? scoreColor(debrief.clarityScore) : "#7B6CFF";

  /* ── LOADING ── */
  if (loading) {
    return (
      <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
        style={{ background: "#02020A", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div className="noise" />
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
          <div style={{ position: "relative", width: 56, height: 56 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
              style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid transparent", borderTopColor: "var(--primary)", borderRightColor: "rgba(123,108,255,0.25)" }}
            />
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              style={{ position: "absolute", inset: 10, borderRadius: "50%", border: "1px solid transparent", borderTopColor: "var(--cyan)", borderRightColor: "rgba(0,217,255,0.15)" }}
            />
          </div>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: "0.2em", marginBottom: "8px" }}>
              ANALYSING SESSION
            </div>
            <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "14px", color: "var(--muted)" }}
            >
              The swarm is reviewing your performance…
            </motion.div>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── DEBRIEF CARDS ── */
  return (
    <motion.div className="screen screen-scroll" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "#02020A" }}
    >
      <div className="noise" />
      <div className="ambient" />

      <div style={{
        position: "relative", zIndex: 1,
        maxWidth: "580px", margin: "0 auto", width: "100%",
        padding: "56px 24px 80px",
        display: "flex", flexDirection: "column", gap: "14px",
      }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.2em", marginBottom: "16px" }}>
            PHASE 4 OF 4 — DEBRIEF
          </div>
        </motion.div>

        {/* Score + rationale */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.55 }}
          style={{
            display: "flex", alignItems: "center", gap: "24px",
            padding: "28px",
            background: "rgba(255,255,255,0.025)",
            border: `1px solid ${color}22`,
            borderRadius: "20px",
          }}
        >
          <ScoreRing score={debrief.clarityScore} color={color} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.16em", marginBottom: "10px" }}>
              CLARITY SCORE
            </div>
            <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "14px", color: "var(--text-2)", lineHeight: 1.7 }}>
              {debrief.clarityRationale}
            </div>
          </div>
        </motion.div>

        {/* Best moment */}
        {debrief.bestMoment && (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            style={{
              padding: "22px 24px", borderRadius: "16px",
              background: "rgba(200,240,100,0.04)",
              border: "1px solid rgba(200,240,100,0.1)",
              borderLeft: "2px solid var(--success)",
            }}
          >
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--success)", letterSpacing: "0.14em", marginBottom: "12px" }}>
              STRONGEST MOMENT
            </div>
            <div style={{ fontFamily: "var(--display)", fontStyle: "italic", fontSize: "15px", lineHeight: 1.8, marginBottom: "10px", color: "var(--text)" }}>
              "{debrief.bestMoment.quote}"
            </div>
            <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "13px", color: "var(--muted)", lineHeight: 1.65 }}>
              {debrief.bestMoment.reason}
            </div>
          </motion.div>
        )}

        {/* Worst moment */}
        {debrief.worstMoment && (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.5 }}
            style={{
              padding: "22px 24px", borderRadius: "16px",
              background: "rgba(255,107,107,0.04)",
              border: "1px solid rgba(255,107,107,0.1)",
              borderLeft: "2px solid var(--coral)",
            }}
          >
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--coral)", letterSpacing: "0.14em", marginBottom: "12px" }}>
              CRITICAL STUMBLE
            </div>
            <div style={{ fontFamily: "var(--display)", fontStyle: "italic", fontSize: "15px", lineHeight: 1.8, marginBottom: "10px", color: "var(--text)" }}>
              "{debrief.worstMoment.quote}"
            </div>
            <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "13px", color: "var(--muted)", lineHeight: 1.65 }}>
              {debrief.worstMoment.reason}
            </div>
          </motion.div>
        )}

        {/* Content gaps */}
        {debrief.contentGaps?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.5 }}
            style={{
              padding: "22px 24px", borderRadius: "16px",
              background: "rgba(245,166,35,0.04)",
              border: "1px solid rgba(245,166,35,0.1)",
              borderLeft: "2px solid var(--amber)",
            }}
          >
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--amber)", letterSpacing: "0.14em", marginBottom: "14px" }}>
              CONTENT GAPS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {debrief.contentGaps.slice(0, 3).map((g, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ color: "var(--amber)", opacity: 0.7, flexShrink: 0, marginTop: "2px" }}>→</span>
                  <div>
                    <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "13px", color: "var(--text)", lineHeight: 1.55 }}>{g.gap}</div>
                    {g.suggestion && (
                      <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{g.suggestion}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Priority fix */}
        {debrief.priorityFix && (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.5 }}
            style={{
              padding: "24px 26px", borderRadius: "16px",
              background: "rgba(123,108,255,0.06)",
              border: "1px solid rgba(123,108,255,0.18)",
            }}
          >
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--primary)", letterSpacing: "0.14em", marginBottom: "12px" }}>
              FOCUS ON THIS
            </div>
            <div style={{ fontFamily: "var(--display)", fontSize: "18px", lineHeight: 1.7, fontWeight: 300 }}>
              {debrief.priorityFix}
            </div>
          </motion.div>
        )}

        {/* Overall verdict */}
        {debrief.overallVerdict && (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            style={{
              padding: "18px 22px", borderRadius: "14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.14em", marginBottom: "10px" }}>
              OVERALL VERDICT
            </div>
            <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "14px", color: "var(--text-2)", lineHeight: 1.7 }}>
              {debrief.overallVerdict}
            </div>
          </motion.div>
        )}

        {/* Q&A Transcript */}
        {sessionResult?.history?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.5 }}
          >
            <button
              onClick={() => setShowTranscript(v => !v)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "15px 20px", borderRadius: "14px",
                background: showTranscript ? "rgba(123,108,255,0.06)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${showTranscript ? "rgba(123,108,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                transition: "all 0.22s",
                position: "relative", overflow: "hidden",
              }}
            >
              {showTranscript && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: "1px",
                  background: "linear-gradient(90deg, transparent, rgba(123,108,255,0.4), transparent)",
                }} />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "14px", opacity: 0.6 }}>◈</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: showTranscript ? "var(--primary)" : "var(--muted)", letterSpacing: "0.14em" }}>
                  FULL TRANSCRIPT
                </span>
                <span style={{
                  padding: "2px 8px", borderRadius: "999px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                  fontFamily: "var(--mono)", fontSize: "9px", color: "var(--muted)",
                }}>
                  {sessionResult.history.length} turns
                </span>
              </div>
              <motion.span
                animate={{ rotate: showTranscript ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", opacity: 0.5, display: "block" }}
              >
                ▼
              </motion.span>
            </button>

            <AnimatePresence>
              {showTranscript && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{
                    marginTop: "8px",
                    background: "rgba(255,255,255,0.015)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "14px",
                    padding: "18px 20px",
                    display: "flex", flexDirection: "column", gap: "16px",
                    maxHeight: "380px", overflowY: "auto", scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.08) transparent",
                  }}>
                    {sessionResult.history.map((turn, i) => {
                      const isUser = turn.speaker === "You";
                      const isQ = !isUser;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: isQ ? -6 : 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.3 }}
                          style={{
                            display: "flex", flexDirection: "column", gap: "5px",
                            paddingLeft: isUser ? "14px" : "0",
                            borderLeft: isUser ? "2px solid rgba(245,166,35,0.3)" : "none",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                            <div style={{
                              width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                              background: isUser ? "var(--amber)" : "var(--teal)",
                              boxShadow: `0 0 6px ${isUser ? "var(--amber)" : "var(--teal)"}`,
                            }} />
                            <span style={{
                              fontFamily: "var(--mono)", fontSize: "9px",
                              color: isUser ? "var(--amber)" : "var(--teal)",
                              letterSpacing: "0.14em",
                            }}>
                              {turn.speaker.toUpperCase()}
                            </span>
                          </div>
                          <p style={{
                            fontFamily: "var(--ui)", fontWeight: 300,
                            fontSize: "13px", color: isUser ? "var(--text)" : "var(--text-2)",
                            lineHeight: 1.65, margin: 0,
                          }}>
                            {turn.text}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Hear debrief button */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.56, duration: 0.5 }}
        >
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleSpeak}
            style={{
              width: "100%", height: "52px", borderRadius: "14px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
              background: isSpeaking ? "rgba(245,166,35,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isSpeaking ? "rgba(245,166,35,0.35)" : "rgba(255,255,255,0.1)"}`,
              color: isSpeaking ? "var(--amber)" : "var(--muted)",
              fontFamily: "var(--mono)", fontSize: "12px", letterSpacing: "0.08em",
              transition: "all 0.25s",
            }}
          >
            {isSpeaking ? (
              <>
                <span className="dot" style={{ background: "var(--amber)", width: "5px", height: "5px" }} />
                SPEAKING — CLICK TO STOP
              </>
            ) : (
              <>
                <span style={{ fontSize: "16px" }}>⏵</span>
                HEAR DEBRIEF ALOUD
              </>
            )}
          </motion.button>
        </motion.div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(255,255,255,0.05)", margin: "6px 0" }} />

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.5 }}
          style={{ display: "flex", flexDirection: "column", gap: "10px" }}
        >
          <button className="btn btn-primary" onClick={() => onAskSwarm?.(debrief)} style={{ width: "100%" }}>
            Ask Swarm AI →
          </button>
          <button className="btn btn-amber" onClick={onRunAgain} style={{ width: "100%" }}>
            Run Again — Harder →
          </button>
        </motion.div>

        {/* Rating widget */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          style={{
            padding: "26px",
            background: "rgba(255,255,255,0.022)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "18px",
            display: "flex", flexDirection: "column", gap: "20px",
          }}
        >
          {!ratingSubmitted ? (
            <>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--primary)", letterSpacing: "0.16em", marginBottom: "6px" }}>
                  RATE THIS SESSION
                </div>
                <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>
                  Swarm adapts to your feedback — your ratings shape the next session.
                </div>
              </div>

              <StarRating label="INTERVIEW QUALITY" value={interviewRating} onChange={setInterviewRating} />
              <AnimatePresence>
                {interviewRating > 0 && interviewRating < 3 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <input value={interviewFeedback} onChange={e => setInterviewFeedback(e.target.value)}
                      placeholder="What didn't work? (e.g. questions too vague, wrong tone...)"
                      style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "10px", padding: "11px 14px", color: "var(--text)", fontFamily: "var(--ui)", fontWeight: 300, fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <StarRating label="DEBRIEF QUALITY" value={debriefRating} onChange={setDebriefRating} />
              <AnimatePresence>
                {debriefRating > 0 && debriefRating < 3 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <input value={debriefFeedback} onChange={e => setDebriefFeedback(e.target.value)}
                      placeholder="What didn't work? (e.g. too brief, too harsh, missing detail...)"
                      style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "10px", padding: "11px 14px", color: "var(--text)", fontFamily: "var(--ui)", fontWeight: 300, fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {(interviewRating > 0 || debriefRating > 0) && (
                  <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="btn btn-ghost"
                    onClick={async () => {
                      try {
                        const token = getIdToken ? await getIdToken() : undefined;
                        await postJSON("/api/feedback", {
                          sessionId: savedSessionId || "unknown",
                          interviewRating: interviewRating || undefined,
                          debriefRating: debriefRating || undefined,
                          interviewFeedback: interviewFeedback || undefined,
                          debriefFeedback: debriefFeedback || undefined,
                        }, token);
                      } catch {}
                      setRatingSubmitted(true);
                    }}
                    style={{ alignSelf: "flex-start" }}
                  >
                    Submit feedback →
                  </motion.button>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--success)", textAlign: "center", letterSpacing: "0.09em" }}>
              ✓ Swarm has noted your feedback — next session will adapt.
            </div>
          )}
        </motion.div>

      </div>
    </motion.div>
  );
}
