import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { streamFetch } from "../lib/api";

const AGENTS = [
  { name: "Researcher",     color: "#7B6CFF", label: "Researcher",      icon: "◎" },
  { name: "Profiler",       color: "#6ee7b7", label: "Profiler",         icon: "◉" },
  { name: "WeakSpotFinder", color: "#c8f064", label: "Weak Spots",       icon: "◈" },
  { name: "VoiceDesigner",  color: "#FF6B6B", label: "Voice Designer",   icon: "◐" },
  { name: "Architect",      color: "#F5A623", label: "Architect",        icon: "◑" },
];

const PHASE = {
  0:   "Initialising agents...",
  20:  "Researching your scenario...",
  40:  "Profiling your panel...",
  60:  "Targeting weak spots...",
  80:  "Designing voices...",
  100: "Session ready.",
};

function phaseLabel(p) {
  return PHASE[[100, 80, 60, 40, 20, 0].find(k => p >= k)] ?? "Architecting...";
}

const sv = {
  initial: { opacity: 0, scale: 0.97, filter: "blur(10px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 1.02, filter: "blur(8px)", transition: { duration: 0.4 } },
};

// SVG connector between agent orbs
function OrbConnector({ from, to, active }) {
  if (!from || !to || !active) return null;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - 15;
  return (
    <path
      d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
      fill="none"
      stroke="rgba(123,108,255,0.25)"
      strokeWidth="1"
      strokeDasharray="4 4"
    />
  );
}

export default function MissionControl({ situation, onBeginSession, getIdToken }) {
  const [outputs, setOutputs] = useState({});
  const [done, setDone] = useState({});
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);
  const cardRefs = useRef({});
  const orbRefs = useRef({});

  useEffect(() => {
    const start = async () => {
      setOutputs({});
      setDone({});
      setSessionData(null);
      setError(null);

      try {
        const token = await getIdToken();
        await streamFetch("/api/start-session", { situation }, chunk => {
          if (chunk.error) { setError(chunk.error); return; }
          if (!chunk.agent) return;
          if (chunk.chunk) setOutputs(p => ({ ...p, [chunk.agent]: (p[chunk.agent] || "") + chunk.chunk }));
          if (chunk.done) {
            setDone(p => ({ ...p, [chunk.agent]: true }));
            if (chunk.sessionData) setSessionData(chunk.sessionData);
          }
        }, token);
      } catch (e) {
        setError(e.message);
      }
    };

    start();
  }, [situation, getIdToken]);

  useEffect(() => {
    Object.values(cardRefs.current).forEach(el => { if (el) el.scrollTop = el.scrollHeight; });
  }, [outputs]);

  const doneCount = Object.keys(done).length;
  const progress = (doneCount / 5) * 100;
  const allDone = doneCount === 5;

  const getState = (name) => {
    if (done[name]) return "done";
    if (outputs[name]?.length > 0) return "active";
    if (name === "Architect" && doneCount < 4) return "waiting";
    return "idle";
  };

  return (
    <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit">
      <div className="ambient" />

      {/* Subtle grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(123,108,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(123,108,255,0.025) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        height: "100%", display: "flex", flexDirection: "column",
        padding: "28px 28px 24px",
        maxWidth: "980px", margin: "0 auto", width: "100%", gap: "18px",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: "0.18em", marginBottom: "6px" }}>
              PHASE 2 OF 4
            </div>
            <div style={{ fontFamily: "var(--display)", fontSize: "28px", fontWeight: 400 }}>Mission Control</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", marginTop: "6px", maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {situation}
            </div>
          </div>
          <motion.div
            animate={{ opacity: allDone ? 1 : 0.8 }}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: allDone ? "rgba(200,240,100,0.08)" : "rgba(110,231,183,0.08)",
              border: `1px solid ${allDone ? "rgba(200,240,100,0.2)" : "rgba(110,231,183,0.18)"}`,
              borderRadius: "999px", padding: "7px 16px",
              transition: "all 0.4s",
            }}
          >
            <span className="dot" style={{
              background: allDone ? "var(--success)" : "var(--teal)",
              animation: allDone ? "none" : undefined,
            }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: allDone ? "var(--success)" : "var(--teal)", letterSpacing: "0.06em" }}>
              {allDone ? "Complete" : "Swarm Active"}
            </span>
          </motion.div>
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                padding: "14px 18px", borderRadius: "12px",
                background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)",
                fontFamily: "var(--mono)", fontSize: "12px", color: "var(--coral)",
              }}
            >
              Error: {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent orb row */}
        <div style={{ display: "flex", justifyContent: "center", gap: "clamp(16px,3vw,40px)", padding: "10px 0" }}>
          {AGENTS.map((a, i) => {
            const state = getState(a.name);
            return (
              <div key={a.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                <div style={{ position: "relative" }} ref={el => orbRefs.current[a.name] = el}>
                  {/* Pulse ring when active */}
                  {state === "active" && (
                    <div style={{
                      position: "absolute", inset: "-10px", borderRadius: "50%",
                      border: `1px solid ${a.color}55`,
                      animation: "orbPulse 1.8s ease-in-out infinite",
                    }} />
                  )}
                  {/* Outer done ring */}
                  {state === "done" && (
                    <div style={{
                      position: "absolute", inset: "-6px", borderRadius: "50%",
                      border: `1px solid ${a.color}33`,
                    }} />
                  )}
                  <motion.div
                    animate={{
                      width: state === "active" ? 54 : 44,
                      height: state === "active" ? 54 : 44,
                    }}
                    transition={{ duration: 0.3 }}
                    style={{
                      borderRadius: "50%",
                      background: state === "idle" || state === "waiting"
                        ? "rgba(255,255,255,0.05)"
                        : `radial-gradient(circle at 35% 30%, ${a.color}ee, ${a.color}44)`,
                      boxShadow: state === "done"
                        ? `0 0 18px ${a.color}33, 0 0 40px ${a.color}11`
                        : state === "active"
                        ? `0 0 28px ${a.color}55, 0 0 56px ${a.color}1a`
                        : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "18px",
                      transition: "background 0.4s, box-shadow 0.4s",
                    }}
                  >
                    <span style={{ color: state === "idle" || state === "waiting" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.92)", lineHeight: 1 }}>
                      {a.icon}
                    </span>
                  </motion.div>
                </div>

                <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: state === "done" ? a.color : "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center" }}>
                  {a.label}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: state === "done" ? "var(--success)" : state === "active" ? a.color : "var(--muted)", opacity: 0.85 }}>
                  {state === "done" ? "✓" : state === "active" ? "●" : state === "waiting" ? "…" : "○"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Agent cards */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", minHeight: 0 }}>
          {AGENTS.slice(0, 3).map(a => (
            <AgentCard key={a.name} agent={a} output={outputs[a.name]} done={done[a.name]} waiting={false} cardRef={el => cardRefs.current[a.name] = el} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {AGENTS.slice(3).map(a => (
            <AgentCard key={a.name} agent={a} output={outputs[a.name]} done={done[a.name]} waiting={a.name === "Architect" && doneCount < 4} cardRef={el => cardRefs.current[a.name] = el} />
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)" }}>{phaseLabel(progress)}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--primary)" }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{
                height: "100%", borderRadius: "2px",
                background: "linear-gradient(90deg, #7B6CFF, #6ee7b7, #c8f064)",
                backgroundSize: "200% 100%",
                animation: "gradientShift 3s ease infinite",
              }}
            />
            {/* Shimmer overlay */}
            {!allDone && (
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                animation: "shimmer 2s ease-in-out infinite",
                backgroundSize: "200% 100%",
              }} />
            )}
          </div>

          <AnimatePresence>
            {allDone && (
              <motion.button
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="btn btn-primary"
                onClick={() => onBeginSession(sessionData)}
                style={{ width: "100%" }}
              >
                Begin Session →
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function AgentCard({ agent, output, done, waiting, cardRef }) {
  const hasOutput = output?.length > 0;
  const state = done ? "done" : waiting ? "waiting" : hasOutput ? "active" : "idle";

  return (
    <div className="card" style={{
      padding: "13px 15px",
      display: "flex", flexDirection: "column", gap: "8px",
      borderColor: done ? `${agent.color}40` : hasOutput ? `${agent.color}18` : "rgba(255,255,255,0.06)",
      minHeight: "90px",
      transition: "border-color 0.4s, box-shadow 0.4s",
      boxShadow: done ? `0 0 0 1px ${agent.color}10, inset 0 0 24px ${agent.color}05` : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: agent.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {agent.label}
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px", color: state === "done" ? "var(--success)" : state === "active" ? agent.color : "var(--muted)" }}>
          {state === "done"
            ? "✓ Done"
            : state === "waiting"
            ? "Waiting…"
            : state === "active"
            ? <><span className="dot" style={{ background: agent.color, width: "5px", height: "5px" }} />Active</>
            : "Idle"}
        </span>
      </div>
      <div
        ref={cardRef}
        style={{
          fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)",
          lineHeight: 1.65, maxHeight: "64px", overflowY: "auto",
          scrollbarWidth: "none", wordBreak: "break-word", flex: 1,
        }}
      >
        {state === "waiting"
          ? <span style={{ opacity: 0.4, fontStyle: "italic" }}>Waiting for peers to complete...</span>
          : !hasOutput
          ? <span style={{ opacity: 0.28 }}>Standby</span>
          : output}
      </div>
    </div>
  );
}
