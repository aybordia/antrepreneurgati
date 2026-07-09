import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { streamFetch } from "../lib/api";

const AGENTS = [
  { name: "Researcher",     color: "#8FB6E8", label: "Researcher",    icon: "◎" },
  { name: "Profiler",       color: "#74B9A0", label: "Profiler",       icon: "◉" },
  { name: "WeakSpotFinder", color: "#B39BD8", label: "Focus Areas",    icon: "◈" },
  { name: "VoiceDesigner",  color: "#D98B8B", label: "Voice Designer", icon: "◐" },
  { name: "Architect",      color: "#E4A339", label: "Architect",      icon: "◑" },
];

const PHASE = {
  0:   "Starting up...",
  20:  "Researching your scenario...",
  40:  "Understanding your panel...",
  60:  "Choosing focus areas...",
  80:  "Matching voices...",
  100: "Your panel is ready.",
};

function phaseLabel(p) {
  return PHASE[[100, 80, 60, 40, 20, 0].find(k => p >= k)] ?? "Architecting...";
}

const sv = {
  initial: { opacity: 0, scale: 0.97, filter: "blur(10px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 1.02, filter: "blur(8px)", transition: { duration: 0.4 } },
};

/* ── Agent orb with animated rings ── */
function AgentOrb({ agent, state }) {
  const isActive = state === "active";
  const isDone = state === "done";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Outer pulse ring */}
        {isActive && (
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: 70, height: 70, borderRadius: "50%",
              border: `1px solid ${agent.color}`,
              pointerEvents: "none",
            }}
          />
        )}
        {/* Mid ring */}
        {(isActive || isDone) && (
          <motion.div
            animate={isActive ? { scale: [1, 1.2, 1], opacity: [0.6, 0.2, 0.6] } : {}}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            style={{
              position: "absolute",
              width: 54, height: 54, borderRadius: "50%",
              border: `1px solid ${agent.color}55`,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Core orb */}
        <motion.div
          animate={{
            width: isActive ? 44 : 36,
            height: isActive ? 44 : 36,
            boxShadow: isDone
              ? `0 0 20px ${agent.color}44, 0 0 40px ${agent.color}18`
              : isActive
              ? `0 0 30px ${agent.color}66, 0 0 60px ${agent.color}22`
              : "none",
          }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          style={{
            borderRadius: "50%",
            background:
              state === "idle" || state === "waiting"
                ? "rgba(255,255,255,0.04)"
                : `radial-gradient(circle at 35% 30%, ${agent.color}ff 0%, ${agent.color}55 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "15px",
            border: `1px solid ${state === "idle" || state === "waiting" ? "rgba(255,255,255,0.06)" : `${agent.color}44`}`,
            transition: "background 0.4s",
          }}
        >
          <span style={{
            color: state === "idle" || state === "waiting" ? "rgba(255,255,255,0.15)" : "white",
            fontSize: "13px",
          }}>
            {agent.icon}
          </span>
        </motion.div>
      </div>

      <div style={{
        fontFamily: "var(--mono)", fontSize: "9px",
        color: isDone ? agent.color : "var(--muted)",
        letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center",
        transition: "color 0.4s",
      }}>
        {agent.label}
      </div>
      <div style={{
        fontFamily: "var(--mono)", fontSize: "9px",
        color: isDone ? "var(--success)" : isActive ? agent.color : "rgba(106,103,128,0.4)",
        transition: "color 0.4s",
      }}>
        {isDone ? "✓" : isActive ? "●" : state === "waiting" ? "…" : "○"}
      </div>
    </div>
  );
}

/* ── Agent card ── */
function AgentCard({ agent, output, done, waiting, cardRef }) {
  const hasOutput = output?.length > 0;
  const state = done ? "done" : waiting ? "waiting" : hasOutput ? "active" : "idle";

  return (
    <div style={{
      position: "relative",
      background: done
        ? `rgba(${hexToRgb(agent.color)}, 0.03)`
        : hasOutput
        ? "rgba(255,255,255,0.025)"
        : "rgba(255,255,255,0.018)",
      border: `1px solid ${done ? `${agent.color}30` : hasOutput ? `${agent.color}14` : "rgba(255,255,255,0.05)"}`,
      borderRadius: "14px",
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: "9px",
      minHeight: "94px", overflow: "hidden",
      transition: "background 0.4s, border-color 0.4s",
    }}>
      {/* Top glow when active */}
      {hasOutput && !done && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "1px",
          background: `linear-gradient(90deg, transparent, ${agent.color}88, transparent)`,
        }} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: agent.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {agent.label}
        </span>
        <span style={{
          fontFamily: "var(--mono)", fontSize: "9px",
          color: state === "done" ? "var(--success)" : state === "active" ? agent.color : "var(--muted)",
          display: "flex", alignItems: "center", gap: "5px",
        }}>
          {state === "done"
            ? "✓ Done"
            : state === "waiting"
            ? "Waiting…"
            : state === "active"
            ? <><span className="dot" style={{ background: agent.color, width: "4px", height: "4px" }} />Active</>
            : "Standby"}
        </span>
      </div>

      <div
        ref={cardRef}
        style={{
          fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)",
          lineHeight: 1.65, maxHeight: "60px", overflowY: "auto",
          scrollbarWidth: "none", wordBreak: "break-word", flex: 1,
        }}
      >
        {state === "waiting"
          ? <span style={{ opacity: 0.35, fontStyle: "italic" }}>Awaiting peers...</span>
          : !hasOutput
          ? <span style={{ opacity: 0.22 }}>Standby</span>
          : output}
      </div>
    </div>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export default function MissionControl({ situation, intent = null, onBeginSession, getIdToken }) {
  const [outputs, setOutputs] = useState({});
  const [done, setDone] = useState({});
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);
  const cardRefs = useRef({});

  useEffect(() => {
    const controller = new AbortController();

    const start = async () => {
      setOutputs({});
      setDone({});
      setSessionData(null);
      setError(null);

      try {
        const token = await getIdToken();
        await streamFetch("/api/start-session", { situation, intent }, chunk => {
          if (controller.signal.aborted) return;
          if (chunk.heartbeat) return;
          if (chunk.error) { setError(chunk.error); return; }
          if (!chunk.agent) return;
          if (chunk.thinking) {
            setOutputs(p => ({ ...p, [chunk.agent]: chunk.chunk }));
            return;
          }
          if (chunk.streamStart) {
            setOutputs(p => ({ ...p, [chunk.agent]: chunk.chunk }));
            return;
          }
          if (chunk.chunk) setOutputs(p => ({ ...p, [chunk.agent]: (p[chunk.agent] || "") + chunk.chunk }));
          if (chunk.done) {
            setDone(p => ({ ...p, [chunk.agent]: true }));
            if (chunk.sessionData) setSessionData(chunk.sessionData);
          }
        }, token, controller.signal);
      } catch (e) {
        if (e.name === "AbortError") return;
        setError(e.message || "Connection failed. Please try again.");
      } finally {
        controller.abort(); // always clean up signal on exit
      }
    };

    start();
    return () => controller.abort();
  }, [situation, intent, getIdToken]);

  useEffect(() => {
    Object.values(cardRefs.current).forEach(el => { if (el) el.scrollTop = el.scrollHeight; });
  }, [outputs]);

  const doneCount = Object.keys(done).length;
  const activeCount = AGENTS.filter(a => outputs[a.name]?.length > 0 && !done[a.name]).length;
  const progress = Math.min(((doneCount + activeCount * 0.5) / 5) * 100, 99);
  const allDone = doneCount === 5;

  const getState = (name) => {
    if (done[name]) return "done";
    if (outputs[name]?.length > 0) return "active";
    if (name === "Architect" && doneCount < 4) return "waiting";
    return "idle";
  };

  return (
    <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "var(--bg)" }}
    >
      <div className="ambient" />
      <div className="noise" />

      {/* Grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), " +
          "linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        height: "100%", display: "flex", flexDirection: "column",
        padding: "28px 28px 24px",
        maxWidth: "1000px", margin: "0 auto", width: "100%", gap: "18px",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.2em", marginBottom: "8px" }}>
              PHASE 2 OF 4
            </div>
            <h1 style={{ fontFamily: "var(--display)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 400, lineHeight: 1.2, marginBottom: "6px" }}>
              Building your panel.
            </h1>
            <div style={{
              fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)",
              maxWidth: "420px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              letterSpacing: "0.03em",
            }}>
              {situation}
            </div>
          </div>

          <motion.div
            animate={{ opacity: 1 }}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: allDone ? "var(--calm-soft)" : "var(--honey-soft)",
              border: `1px solid ${allDone ? "rgba(116,185,160,0.3)" : "rgba(228,163,57,0.3)"}`,
              borderRadius: "999px", padding: "7px 16px",
              transition: "all 0.5s",
            }}
          >
            <span className="dot" style={{
              background: allDone ? "var(--success)" : "var(--primary)",
              animation: allDone ? "none" : undefined,
            }} />
            <span style={{
              fontFamily: "var(--mono)", fontSize: "10px",
              color: allDone ? "var(--success)" : "var(--primary)",
              letterSpacing: "0.08em",
            }}>
              {allDone ? "COMPLETE" : "SWARM ACTIVE"}
            </span>
          </motion.div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                padding: "14px 18px", borderRadius: "12px",
                background: "rgba(255,107,107,0.07)", border: "1px solid rgba(255,107,107,0.18)",
                fontFamily: "var(--mono)", fontSize: "11px", color: "var(--coral)",
              }}
            >
              Error: {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent orbs */}
        <div style={{
          display: "flex", justifyContent: "center",
          gap: "clamp(20px, 4vw, 56px)",
          padding: "12px 0",
        }}>
          {AGENTS.map((a) => (
            <AgentOrb key={a.name} agent={a} state={getState(a.name)} />
          ))}
        </div>

        {/* Connection line */}
        <div style={{
          position: "relative", height: "1px",
          background: "rgba(255,255,255,0.04)",
          marginTop: "-6px",
        }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #74B9A0, #E4A339)",
              boxShadow: "0 0 8px rgba(228,163,57,0.35)",
            }}
          />
        </div>

        {/* Agent cards — 3 top, 2 bottom */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
          {AGENTS.slice(0, 3).map(a => (
            <AgentCard
              key={a.name} agent={a}
              output={outputs[a.name]} done={done[a.name]} waiting={false}
              cardRef={el => cardRefs.current[a.name] = el}
            />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {AGENTS.slice(3).map(a => (
            <AgentCard
              key={a.name} agent={a}
              output={outputs[a.name]} done={done[a.name]}
              waiting={a.name === "Architect" && doneCount < 4}
              cardRef={el => cardRefs.current[a.name] = el}
            />
          ))}
        </div>

        {/* Progress bar + launch */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.06em" }}>
              {phaseLabel(progress)}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--primary)", letterSpacing: "0.04em" }}>
              {Math.round(progress)}%
            </span>
          </div>

          <div style={{
            height: "3px", borderRadius: "2px",
            background: "rgba(255,255,255,0.04)",
            position: "relative", overflow: "hidden",
          }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{
                height: "100%", borderRadius: "2px",
                background: "linear-gradient(90deg, #74B9A0, #E4A339)",
                backgroundSize: "200% 100%",
                animation: "gradientShift 3s ease infinite",
              }}
            />
            {!allDone && (
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                animation: "shimmer 2s ease-in-out infinite",
              }} />
            )}
          </div>

          <AnimatePresence>
            {allDone && (
              <motion.button
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="btn btn-primary"
                onClick={() => onBeginSession(sessionData)}
                style={{ width: "100%" }}
              >
                Meet your panel
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
