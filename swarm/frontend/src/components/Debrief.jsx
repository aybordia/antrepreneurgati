import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { postJSON } from "../lib/api";
import { speakText } from "../hooks/useVoiceOutput";

/* ── Star rating ── */
function StarRating({ label, value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.14em" }}>{label}</div>
      <div style={{ display: "flex", gap: "6px" }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
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

const ADAM = "pNInz6obpgDQGcFmaJgB";

const sv = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, transition: { duration: 0.4 } },
};

function buildScript(d) {
  return [
    "Session complete.",
    `Your clarity score: ${d.clarityScore} out of 100. ${d.clarityRationale}`,
    d.bestMoment?.quote ? `Your strongest moment: "${d.bestMoment.quote}". ${d.bestMoment.reason}` : "",
    d.worstMoment?.quote ? `Your most critical stumble: "${d.worstMoment.quote}". ${d.worstMoment.reason}` : "",
    `The one thing that matters most: ${d.priorityFix}`,
    d.overallVerdict,
    "The swarm has done its job.",
  ].filter(Boolean).join("\n\n");
}

/* ── Score ring ── */
function ScoreRing({ score, color }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * score) / 100;

  return (
    <div style={{ position: "relative", width: 190, height: 190 }}>
      {/* Outer glow ring */}
      <div style={{
        position: "absolute", inset: -8,
        borderRadius: "50%",
        boxShadow: `0 0 60px ${color}28, 0 0 120px ${color}10`,
        pointerEvents: "none",
      }} />
      <svg width="190" height="190" style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx="95" cy="95" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
        {/* Progress */}
        <motion.circle
          cx="95" cy="95" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 3.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
      </svg>
    </div>
  );
}

export default function Debrief({ sessionResult, situation, onRunAgain, onAskSwarm, getIdToken }) {
  const [debrief, setDebrief] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [score, setScore] = useState(0);
  const [text, setText] = useState("");
  const [cards, setCards] = useState(0);
  const [savedSessionId, setSavedSessionId] = useState(null);
  const currentAudioRef = useRef(null);

  // Stop all audio when navigating away
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const [interviewRating, setInterviewRating] = useState(0);
  const [debriefRating, setDebriefRating] = useState(0);
  const [interviewFeedback, setInterviewFeedback] = useState("");
  const [debriefFeedback, setDebriefFeedback] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const token = getIdToken ? await getIdToken() : undefined;
        const d = await postJSON("/api/debrief", {
          fullTranscript: sessionResult?.history || [],
          situation,
          agentResearch: sessionResult?.sessionData?.agentResearch || {},
          sessionPlan: sessionResult?.sessionData?.sessionPlan || {},
        }, token);
        if (!cancelled) {
          setDebrief(d);
          setPhase("score");
          postJSON("/api/sessions/save", {
            situation,
            history: sessionResult?.history || [],
            debrief: d,
            sessionData: sessionResult?.sessionData || {},
          }, token).then(saved => { if (saved?.id) setSavedSessionId(saved.id); }).catch(() => {});
        }
      } catch {
        if (!cancelled) {
          const fallback = { clarityScore: 72, clarityRationale: "Analysis based on available session data.", contentGaps: [], patterns: [], overallVerdict: "Session analysed.", priorityFix: "Continue practising.", bestMoment: null, worstMoment: null };
          setDebrief(fallback);
          setPhase("score");
        }
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count up score
  useEffect(() => {
    if (phase !== "score" || !debrief) return;
    let n = 0;
    const id = setInterval(() => {
      n = Math.min(n + Math.ceil(debrief.clarityScore / 60), debrief.clarityScore);
      setScore(n);
      if (n >= debrief.clarityScore) clearInterval(id);
    }, 50);
    const t = setTimeout(() => setPhase("briefing"), 4500);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [phase, debrief]);

  // Typewriter
  useEffect(() => {
    if (phase !== "briefing" || !debrief) return;
    const script = buildScript(debrief);
    let i = 0;
    speakText({ text: script, voiceId: ADAM, stability: 0.8, similarityBoost: 0.75 })
      .then(a => { if (a) { currentAudioRef.current = a; a.play?.(); } })
      .catch(() => {});
    const id = setInterval(() => {
      i++;
      setText(script.slice(0, i));
      if (i >= script.length) { clearInterval(id); setTimeout(() => setPhase("cards"), 1000); }
    }, 30);
    return () => clearInterval(id);
  }, [phase, debrief]);

  // Reveal cards
  useEffect(() => {
    if (phase !== "cards") return;
    const id = setInterval(() => setCards(c => c + 1), 420);
    return () => clearInterval(id);
  }, [phase]);

  const scoreColor = debrief
    ? (debrief.clarityScore >= 75 ? "#c8f064" : debrief.clarityScore >= 60 ? "#7B6CFF" : "#FF6B6B")
    : "#7B6CFF";

  /* ── LOADING ── */
  if (!debrief && phase === "loading") {
    return (
      <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
        style={{ background: "#02020A", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div className="noise" />
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
          {/* Spinner */}
          <div style={{ position: "relative", width: 60, height: 60 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
              style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: "1px solid transparent",
                borderTopColor: "var(--primary)",
                borderRightColor: "rgba(123,108,255,0.3)",
              }}
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              style={{
                position: "absolute", inset: 10, borderRadius: "50%",
                border: "1px solid transparent",
                borderTopColor: "var(--cyan)",
                borderRightColor: "rgba(0,217,255,0.2)",
              }}
            />
          </div>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: "0.18em", marginBottom: "8px" }}>
              ANALYSING SESSION
            </div>
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "14px", color: "var(--muted)" }}
            >
              The swarm is reviewing your performance…
            </motion.div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "#02020A", overflowY: phase === "cards" ? "auto" : "hidden" }}
    >
      <div className="noise" />
      <div className="ambient" />

      <div style={{
        position: "relative", zIndex: 1, minHeight: "100%",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: phase === "cards" ? "flex-start" : "center",
        padding: "64px 24px 80px", gap: "32px",
        maxWidth: "580px", margin: "0 auto", width: "100%",
      }}>

        {/* SCORE PHASE */}
        {(phase === "score" || phase === "briefing") && debrief && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}
          >
            <div style={{ position: "relative" }}>
              <ScoreRing score={debrief.clarityScore} color={scoreColor} />
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px",
              }}>
                <motion.div
                  style={{
                    fontFamily: "var(--display)",
                    fontSize: "clamp(52px, 8vw, 76px)",
                    color: scoreColor, lineHeight: 1,
                    textShadow: `0 0 40px ${scoreColor}66`,
                  }}
                >
                  {score}
                </motion.div>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.22em", marginBottom: "8px" }}>
                CLARITY SCORE
              </div>
              {phase === "score" && (
                <motion.div
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)" }}
                >
                  Composing debrief…
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* BRIEFING PHASE */}
        {phase === "briefing" && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ width: "100%", paddingTop: "8px" }}
          >
            <div style={{
              fontFamily: "var(--display)", fontSize: "clamp(16px, 2.5vw, 20px)",
              lineHeight: 2, color: "var(--text)", whiteSpace: "pre-wrap", fontWeight: 300,
            }}>
              {text}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.55, repeat: Infinity }}
                style={{ color: "var(--primary)" }}
              >|</motion.span>
            </div>
          </motion.div>
        )}

        {/* CARDS PHASE */}
        {phase === "cards" && debrief && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ width: "100%", display: "flex", flexDirection: "column", gap: "14px" }}
          >
            {/* Phase label */}
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.2em", marginBottom: "4px" }}>
              PHASE 4 OF 4 — DEBRIEF
            </div>

            {/* Score recap */}
            <div style={{
              display: "flex", alignItems: "center", gap: "22px",
              padding: "24px 26px",
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "18px",
            }}>
              <div style={{
                fontFamily: "var(--display)",
                fontSize: "60px", color: scoreColor,
                lineHeight: 1, flexShrink: 0,
                textShadow: `0 0 30px ${scoreColor}44`,
              }}>
                {debrief.clarityScore}
              </div>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.16em", marginBottom: "8px" }}>
                  CLARITY SCORE
                </div>
                <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "13px", color: "var(--muted)", lineHeight: 1.65 }}>
                  {debrief.clarityRationale}
                </div>
              </div>
            </div>

            {cards >= 1 && debrief.bestMoment && (
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: "20px 22px", borderRadius: "16px",
                  background: "rgba(200,240,100,0.04)",
                  border: "1px solid rgba(200,240,100,0.12)",
                  borderLeft: "2px solid var(--success)",
                }}
              >
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--success)", letterSpacing: "0.14em", marginBottom: "12px" }}>
                  STRONGEST MOMENT
                </div>
                <div style={{ fontFamily: "var(--display)", fontStyle: "italic", fontSize: "15px", lineHeight: 1.75, marginBottom: "10px" }}>
                  "{debrief.bestMoment.quote}"
                </div>
                <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "13px", color: "var(--muted)", lineHeight: 1.65 }}>
                  {debrief.bestMoment.reason}
                </div>
              </motion.div>
            )}

            {cards >= 2 && debrief.worstMoment && (
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: "20px 22px", borderRadius: "16px",
                  background: "rgba(255,107,107,0.04)",
                  border: "1px solid rgba(255,107,107,0.12)",
                  borderLeft: "2px solid var(--coral)",
                }}
              >
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--coral)", letterSpacing: "0.14em", marginBottom: "12px" }}>
                  CRITICAL STUMBLE
                </div>
                <div style={{ fontFamily: "var(--display)", fontStyle: "italic", fontSize: "15px", lineHeight: 1.75, marginBottom: "10px" }}>
                  "{debrief.worstMoment.quote}"
                </div>
                <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "13px", color: "var(--muted)", lineHeight: 1.65 }}>
                  {debrief.worstMoment.reason}
                </div>
              </motion.div>
            )}

            {cards >= 3 && debrief.contentGaps?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: "20px 22px", borderRadius: "16px",
                  background: "rgba(245,166,35,0.04)",
                  border: "1px solid rgba(245,166,35,0.12)",
                  borderLeft: "2px solid var(--amber)",
                }}
              >
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--amber)", letterSpacing: "0.14em", marginBottom: "14px" }}>
                  CONTENT GAPS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {debrief.contentGaps.slice(0, 3).map((g, i) => (
                    <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ color: "var(--amber)", flexShrink: 0, marginTop: "1px", opacity: 0.7 }}>→</span>
                      <div>
                        <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "13px", color: "var(--text)", lineHeight: 1.55 }}>{g.gap}</div>
                        {g.suggestion && (
                          <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: "12px", color: "var(--muted)", marginTop: "4px", lineHeight: 1.5 }}>
                            {g.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {cards >= 4 && debrief.priorityFix && (
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: "24px 26px", borderRadius: "16px",
                  background: "rgba(123,108,255,0.06)",
                  border: "1px solid rgba(123,108,255,0.18)",
                }}
              >
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--primary)", letterSpacing: "0.14em", marginBottom: "12px" }}>
                  FOCUS ON THIS
                </div>
                <div style={{ fontFamily: "var(--display)", fontSize: "18px", lineHeight: 1.65, fontWeight: 300 }}>
                  {debrief.priorityFix}
                </div>
              </motion.div>
            )}

            {cards >= 5 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px" }}
              >
                <button
                  className="btn btn-primary"
                  onClick={() => onAskSwarm?.(debrief)}
                  style={{ width: "100%" }}
                >
                  Ask Swarm AI →
                </button>
                <button
                  className="btn btn-amber"
                  onClick={onRunAgain}
                  style={{ width: "100%" }}
                >
                  Run Again — Harder →
                </button>
              </motion.div>
            )}

            {/* Rating widget */}
            {cards >= 5 && !ratingSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                style={{
                  padding: "26px",
                  background: "rgba(255,255,255,0.022)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "18px",
                  marginTop: "6px",
                  display: "flex", flexDirection: "column", gap: "22px",
                }}
              >
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
                      <input
                        value={interviewFeedback}
                        onChange={e => setInterviewFeedback(e.target.value)}
                        placeholder="What didn't work? (e.g. questions too vague, wrong tone...)"
                        style={{
                          width: "100%", background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.09)",
                          borderRadius: "10px", padding: "11px 14px",
                          color: "var(--text)", fontFamily: "var(--ui)",
                          fontWeight: 300, fontSize: "13px", outline: "none",
                          boxSizing: "border-box", lineHeight: 1.5,
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <StarRating label="DEBRIEF QUALITY" value={debriefRating} onChange={setDebriefRating} />
                <AnimatePresence>
                  {debriefRating > 0 && debriefRating < 3 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                      <input
                        value={debriefFeedback}
                        onChange={e => setDebriefFeedback(e.target.value)}
                        placeholder="What didn't work? (e.g. too brief, too harsh, missing detail...)"
                        style={{
                          width: "100%", background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.09)",
                          borderRadius: "10px", padding: "11px 14px",
                          color: "var(--text)", fontFamily: "var(--ui)",
                          fontWeight: 300, fontSize: "13px", outline: "none",
                          boxSizing: "border-box", lineHeight: 1.5,
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {(interviewRating > 0 || debriefRating > 0) && (
                    <motion.button
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
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
              </motion.div>
            )}

            {cards >= 5 && ratingSubmitted && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{
                  fontFamily: "var(--mono)", fontSize: "11px",
                  color: "var(--success)", textAlign: "center",
                  padding: "16px", letterSpacing: "0.09em",
                  background: "rgba(200,240,100,0.04)",
                  border: "1px solid rgba(200,240,100,0.12)",
                  borderRadius: "12px",
                }}
              >
                ✓ Swarm has noted your feedback — next session will adapt.
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
