import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { postJSON } from "../lib/api";
import { speakText, stopAllAudio } from "../hooks/useVoiceOutput";
import { saveSession } from "../lib/localSessions";

const ADAM = "pNInz6obpgDQGcFmaJgB";

/* ── Parse transcript into Q&A pairs ── */
function buildQAPairs(history) {
  const pairs = [];
  let pendingQ = null;
  for (const turn of (history || [])) {
    const isUser = turn.speaker === "You" || turn.speaker === "User";
    if (!isUser) {
      pendingQ = { question: turn.text, speaker: turn.speaker };
    } else if (pendingQ) {
      const words = (turn.text || "").split(/\s+/).filter(Boolean).length;
      pairs.push({ question: pendingQ.question, speaker: pendingQ.speaker, answer: turn.text || "", words });
      pendingQ = null;
    }
  }
  return pairs;
}

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
  const [showQA, setShowQA] = useState(false);
  const [copied, setCopied] = useState(false);
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

        {/* Q&A Breakdown */}
        {sessionResult?.history?.length > 0 && (() => {
          const pairs = buildQAPairs(sessionResult.history);
          if (!pairs.length) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.54, duration: 0.5 }}
            >
              <button
                onClick={() => setShowQA(v => !v)}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "15px 20px", borderRadius: "14px",
                  background: showQA ? "rgba(0,217,255,0.05)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${showQA ? "rgba(0,217,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                  transition: "all 0.22s", position: "relative", overflow: "hidden",
                }}
              >
                {showQA && (
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,217,255,0.4), transparent)" }} />
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "14px", opacity: 0.6 }}>◑</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: showQA ? "var(--cyan)" : "var(--muted)", letterSpacing: "0.14em" }}>
                    Q&A BREAKDOWN
                  </span>
                  <span style={{ padding: "2px 8px", borderRadius: "999px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "var(--mono)", fontSize: "9px", color: "var(--muted)" }}>
                    {pairs.length} exchanges
                  </span>
                </div>
                <motion.span animate={{ rotate: showQA ? 180 : 0 }} transition={{ duration: 0.2 }}
                  style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", opacity: 0.5 }}>▼</motion.span>
              </button>

              <AnimatePresence>
                {showQA && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {pairs.map((p, i) => {
                        const isShort = p.words < 20;
                        const isStrong = p.words >= 50;
                        return (
                          <div key={i} style={{
                            borderRadius: "14px",
                            background: "rgba(255,255,255,0.018)",
                            border: "1px solid rgba(255,255,255,0.05)",
                            overflow: "hidden",
                          }}>
                            {/* Question */}
                            <div style={{
                              padding: "14px 18px 10px",
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              display: "flex", gap: "10px", alignItems: "flex-start",
                            }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--teal)", marginTop: "7px", flexShrink: 0, boxShadow: "0 0 6px var(--teal)" }} />
                              <div>
                                <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--teal)", letterSpacing: "0.12em", marginBottom: "5px" }}>
                                  {p.speaker.toUpperCase()} ASKED
                                </div>
                                <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--text-2)", lineHeight: 1.65 }}>
                                  {p.question}
                                </div>
                              </div>
                            </div>
                            {/* Answer */}
                            <div style={{ padding: "12px 18px 14px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--amber)", marginTop: "7px", flexShrink: 0, boxShadow: "0 0 6px var(--amber)" }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                                  <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--amber)", letterSpacing: "0.12em" }}>YOUR ANSWER</div>
                                  <div style={{
                                    padding: "1px 7px", borderRadius: "999px",
                                    background: isShort ? "rgba(255,107,107,0.1)" : isStrong ? "rgba(200,240,100,0.1)" : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${isShort ? "rgba(255,107,107,0.25)" : isStrong ? "rgba(200,240,100,0.25)" : "rgba(255,255,255,0.06)"}`,
                                    fontFamily: "var(--mono)", fontSize: "9px",
                                    color: isShort ? "var(--coral)" : isStrong ? "var(--success)" : "var(--muted)",
                                  }}>
                                    {p.words}w {isShort ? "· too short" : isStrong ? "· strong" : ""}
                                  </div>
                                </div>
                                <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--text)", lineHeight: 1.65 }}>
                                  {p.answer || <span style={{ opacity: 0.3 }}>No response recorded</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })()}

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

          {/* Community waitlist CTA */}
          <a
            href="https://form.typeform.com/to/pVmDViYF"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: "14px",
              padding: "16px 20px", borderRadius: "14px",
              border: "1px solid rgba(123,108,255,0.22)",
              background: "rgba(123,108,255,0.06)",
              textDecoration: "none",
              transition: "all 0.2s",
              marginTop: "2px",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(123,108,255,0.12)"; e.currentTarget.style.borderColor = "rgba(123,108,255,0.38)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(123,108,255,0.06)"; e.currentTarget.style.borderColor = "rgba(123,108,255,0.22)"; }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: "10px", flexShrink: 0,
              background: "rgba(123,108,255,0.15)",
              border: "1px solid rgba(123,108,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px",
            }}>✦</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "#a09aff", letterSpacing: "0.08em", marginBottom: "3px" }}>
                ENJOYED YOUR SESSION?
              </div>
              <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", lineHeight: 1.4 }}>
                Join our community and be the first to know about new features.
              </div>
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "rgba(160,154,255,0.5)", flexShrink: 0 }}>→</span>
          </a>
        </motion.div>

        {/* Share Card */}
        {debrief && (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.66, duration: 0.5 }}
            style={{
              borderRadius: "20px",
              background: "rgba(255,255,255,0.022)",
              border: "1px solid rgba(255,255,255,0.07)",
              overflow: "hidden",
            }}
          >
            {/* Card header */}
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", opacity: 0.5 }}>◈</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.14em" }}>SHARE YOUR RESULT</span>
              </div>
              <button
                onClick={() => {
                  const qaPairs = buildQAPairs(sessionResult?.history || []);
                  const avgWords = qaPairs.length ? Math.round(qaPairs.reduce((s, p) => s + p.words, 0) / qaPairs.length) : 0;
                  const text = [
                    `🤖 Swarm AI Interview Practice`,
                    ``,
                    `📊 Clarity Score: ${debrief.clarityScore}/100`,
                    `🎯 Session: ${situation?.slice(0, 80)}${situation?.length > 80 ? "…" : ""}`,
                    `💬 Exchanges: ${qaPairs.length} · Avg answer: ${avgWords} words`,
                    ``,
                    `💡 Focus: ${debrief.priorityFix}`,
                    ``,
                    `Practice with Swarm AI → swarm-ai-ruddy.vercel.app`,
                  ].join("\n");
                  navigator.clipboard.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                style={{
                  padding: "5px 14px", borderRadius: "8px",
                  border: `1px solid ${copied ? "rgba(77,221,170,0.4)" : "rgba(255,255,255,0.1)"}`,
                  background: copied ? "rgba(77,221,170,0.1)" : "rgba(255,255,255,0.04)",
                  color: copied ? "var(--teal)" : "var(--muted)",
                  fontFamily: "var(--mono)", fontSize: "10px", letterSpacing: "0.06em",
                  transition: "all 0.2s",
                }}
              >
                {copied ? "✓ COPIED" : "COPY TEXT"}
              </button>
            </div>

            {/* The shareable card itself */}
            <div style={{
              padding: "28px 24px",
              background: "linear-gradient(135deg, rgba(123,108,255,0.06) 0%, rgba(0,217,255,0.03) 50%, rgba(77,221,170,0.04) 100%)",
              position: "relative",
            }}>
              {/* Grid bg */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }} />

              {/* Swarm AI brand */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", position: "relative" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 10px var(--primary)" }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.3em" }}>SWARM AI</span>
              </div>

              {/* Score + situation */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "20px", marginBottom: "20px", position: "relative" }}>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--display)", fontSize: "56px", color, lineHeight: 1, textShadow: `0 0 30px ${color}44` }}>
                    {debrief.clarityScore}
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--muted)", letterSpacing: "0.12em", marginTop: "4px" }}>/100 CLARITY</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--muted)", letterSpacing: "0.12em", marginBottom: "6px" }}>SESSION</div>
                  <div style={{ fontFamily: "var(--display)", fontSize: "15px", color: "var(--text)", lineHeight: 1.5 }}>
                    {situation?.slice(0, 100)}{situation?.length > 100 ? "…" : ""}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "18px", position: "relative" }}>
                {[
                  { label: "EXCHANGES", value: buildQAPairs(sessionResult?.history || []).length },
                  { label: "AVG ANSWER", value: (() => { const p = buildQAPairs(sessionResult?.history || []); return p.length ? `${Math.round(p.reduce((s,q)=>s+q.words,0)/p.length)}w` : "—"; })() },
                  { label: "SCORE BAND", value: debrief.clarityScore >= 75 ? "STRONG" : debrief.clarityScore >= 60 ? "SOLID" : "DEVELOPING" },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    flex: 1, padding: "10px 12px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "10px",
                  }}>
                    <div style={{ fontFamily: "var(--display)", fontSize: "16px", color: "var(--text)", lineHeight: 1, marginBottom: "4px" }}>{value}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "8px", color: "var(--muted)", letterSpacing: "0.1em" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Priority fix */}
              <div style={{
                padding: "12px 16px", borderRadius: "10px",
                background: "rgba(123,108,255,0.08)", border: "1px solid rgba(123,108,255,0.18)",
                position: "relative",
              }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--primary)", letterSpacing: "0.12em", marginBottom: "5px" }}>NEXT FOCUS</div>
                <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--text-2)", lineHeight: 1.55 }}>{debrief.priorityFix}</div>
              </div>

              <div style={{ marginTop: "14px", fontFamily: "var(--mono)", fontSize: "9px", color: "rgba(106,103,128,0.4)", letterSpacing: "0.08em", position: "relative" }}>
                swarm-ai-ruddy.vercel.app · screenshot to share
              </div>
            </div>
          </motion.div>
        )}

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
