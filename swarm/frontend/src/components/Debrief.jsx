import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { postJSON } from "../lib/api";
import { speakText } from "../hooks/useVoiceOutput";

const ADAM = "pNInz6obpgDQGcFmaJgB";

const sv = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.8 } },
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

function ScoreRing({ score, color }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * score) / 100;

  return (
    <svg width="180" height="180" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <motion.circle
        cx="90" cy="90" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 3, ease: "easeInOut" }}
      />
    </svg>
  );
}

export default function Debrief({ sessionResult, situation, onRunAgain, onAskSwarm, getIdToken }) {
  const [debrief, setDebrief] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [score, setScore] = useState(0);
  const [text, setText] = useState("");
  const [cards, setCards] = useState(0);

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
        if (!cancelled) { setDebrief(d); setPhase("score"); }
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
    const t = setTimeout(() => setPhase("briefing"), 4200);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [phase, debrief]);

  // Typewriter
  useEffect(() => {
    if (phase !== "briefing" || !debrief) return;
    const script = buildScript(debrief);
    let i = 0;
    speakText({ text: script, voiceId: ADAM, stability: 0.8, similarityBoost: 0.75 })
      .then(a => a?.play?.())
      .catch(() => {});
    const id = setInterval(() => {
      i++;
      setText(script.slice(0, i));
      if (i >= script.length) { clearInterval(id); setTimeout(() => setPhase("cards"), 1200); }
    }, 32);
    return () => clearInterval(id);
  }, [phase, debrief]);

  // Reveal cards
  useEffect(() => {
    if (phase !== "cards") return;
    const id = setInterval(() => setCards(c => c + 1), 450);
    return () => clearInterval(id);
  }, [phase]);

  if (!debrief && phase === "loading") {
    return (
      <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
        style={{ background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "var(--muted)", letterSpacing: "0.15em" }}>ANALYSING SESSION...</div>
          <div style={{ marginTop: "16px", width: "120px", height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px", margin: "16px auto 0" }}>
            <motion.div style={{ height: "100%", background: "var(--primary)", borderRadius: "1px" }} animate={{ width: ["0%","100%","0%"] }} transition={{ duration: 2, repeat: Infinity }} />
          </div>
        </div>
      </motion.div>
    );
  }

  const scoreColor = debrief ? (debrief.clarityScore >= 75 ? "#c8f064" : debrief.clarityScore >= 60 ? "#7B6CFF" : "#FF6B6B") : "#7B6CFF";

  return (
    <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "#000", overflowY: phase === "cards" ? "auto" : "hidden" }}
    >
      <div className="ambient" />
      <div style={{
        position: "relative", zIndex: 1, minHeight: "100%",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: phase === "cards" ? "flex-start" : "center",
        padding: "60px 24px", gap: "32px",
        maxWidth: "600px", margin: "0 auto", width: "100%",
      }}>

        {/* SCORE PHASE */}
        {(phase === "score" || phase === "briefing") && debrief && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}
          >
            <div style={{ position: "relative", width: "180px", height: "180px" }}>
              <ScoreRing score={debrief.clarityScore} color={scoreColor} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontFamily: "var(--display)", fontSize: "clamp(48px,8vw,72px)", color: scoreColor, lineHeight: 1 }}>{score}</div>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: "0.2em" }}>CLARITY SCORE</div>
            </div>
          </motion.div>
        )}

        {/* BRIEFING PHASE */}
        {phase === "briefing" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: "100%" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: "18px", lineHeight: 2, color: "var(--text)", whiteSpace: "pre-wrap" }}>
              {text}
              <motion.span animate={{ opacity: [1,0] }} transition={{ duration: 0.6, repeat: Infinity }}>|</motion.span>
            </div>
          </motion.div>
        )}

        {/* CARDS PHASE */}
        {phase === "cards" && debrief && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Score recap */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px", padding: "24px", background: "rgba(255,255,255,0.03)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontFamily: "var(--display)", fontSize: "56px", color: scoreColor, lineHeight: 1, flexShrink: 0 }}>{debrief.clarityScore}</div>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.15em", marginBottom: "8px" }}>CLARITY SCORE</div>
                <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>{debrief.clarityRationale}</div>
              </div>
            </div>

            {cards >= 1 && debrief.bestMoment && (
              <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                style={{ padding: "20px 22px", borderLeft: "3px solid var(--success)" }}
              >
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--success)", letterSpacing: "0.12em", marginBottom: "10px" }}>STRONGEST MOMENT</div>
                <div style={{ fontFamily: "var(--display)", fontStyle: "italic", fontSize: "15px", lineHeight: 1.7, marginBottom: "8px" }}>"{debrief.bestMoment.quote}"</div>
                <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>{debrief.bestMoment.reason}</div>
              </motion.div>
            )}

            {cards >= 2 && debrief.worstMoment && (
              <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                style={{ padding: "20px 22px", borderLeft: "3px solid var(--coral)" }}
              >
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--coral)", letterSpacing: "0.12em", marginBottom: "10px" }}>CRITICAL STUMBLE</div>
                <div style={{ fontFamily: "var(--display)", fontStyle: "italic", fontSize: "15px", lineHeight: 1.7, marginBottom: "8px" }}>"{debrief.worstMoment.quote}"</div>
                <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>{debrief.worstMoment.reason}</div>
              </motion.div>
            )}

            {cards >= 3 && debrief.contentGaps?.length > 0 && (
              <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                style={{ padding: "20px 22px", borderLeft: "3px solid var(--amber)" }}
              >
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--amber)", letterSpacing: "0.12em", marginBottom: "12px" }}>CONTENT GAPS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {debrief.contentGaps.slice(0, 3).map((g, i) => (
                    <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <span style={{ color: "var(--amber)", flexShrink: 0, marginTop: "1px" }}>→</span>
                      <div>
                        <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--text)", lineHeight: 1.5 }}>{g.gap}</div>
                        {g.suggestion && <div style={{ fontFamily: "var(--ui)", fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{g.suggestion}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {cards >= 4 && debrief.priorityFix && (
              <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                style={{ padding: "24px", background: "rgba(123,108,255,0.06)", borderColor: "rgba(123,108,255,0.2)" }}
              >
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--primary)", letterSpacing: "0.12em", marginBottom: "12px" }}>FOCUS ON THIS</div>
                <div style={{ fontFamily: "var(--display)", fontSize: "18px", lineHeight: 1.6 }}>{debrief.priorityFix}</div>
              </motion.div>
            )}

            {cards >= 5 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}
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
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
