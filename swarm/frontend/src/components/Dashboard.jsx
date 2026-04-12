import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getJSON } from "../lib/api";
import { getSessions as getLocalSessions } from "../lib/localSessions";

const sv = {
  initial: { opacity: 0, filter: "blur(10px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, filter: "blur(8px)", transition: { duration: 0.35 } },
};

function scoreColor(s) {
  if (s === null || s === undefined) return "var(--muted)";
  if (s >= 75) return "#c8f064";
  if (s >= 60) return "#7B6CFF";
  return "#FF6B6B";
}

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

/* ── Score trend chart ── */
function TrendGraph({ sessions }) {
  const scored = [...sessions]
    .filter(s => s.clarityScore !== null && s.clarityScore !== undefined)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-8);

  if (scored.length < 2) return null;

  const W = 600, H = 130;
  const PAD = { top: 14, right: 20, bottom: 30, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const scores = scored.map(s => s.clarityScore);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);

  const xOf = i => PAD.left + (i / (scored.length - 1)) * innerW;
  const yOf = s  => PAD.top + innerH * (1 - (s - minScore) / (maxScore - minScore));

  const pts = scored.map((s, i) => ({ x: xOf(i), y: yOf(s.clarityScore), score: s.clarityScore }));

  const linePath = pts.map((pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + pt.x) / 2;
    return `C${cpx},${prev.y} ${cpx},${pt.y} ${pt.x},${pt.y}`;
  }).join(" ");

  const areaPath = `${linePath} L${pts[pts.length - 1].x},${H - PAD.bottom} L${pts[0].x},${H - PAD.bottom} Z`;

  const latest = scores[scores.length - 1];
  const delta  = latest - scores[0];

  const midY = yOf(minScore + (maxScore - minScore) * 0.5);
  const topY = yOf(maxScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.55 }}
      style={{
        background: "rgba(255,255,255,0.022)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "18px",
        padding: "20px 20px 10px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Glow behind latest dot */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: "180px", height: "180px",
        background: `radial-gradient(circle at 80% 40%, ${scoreColor(latest)}12 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: "12px", position: "relative", zIndex: 1,
      }}>
        <div>
          <div style={{
            fontFamily: "var(--mono)", fontSize: "9px",
            color: "rgba(106,103,128,0.5)", letterSpacing: "0.18em", marginBottom: "5px",
          }}>
            SCORE PROGRESSION
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
            <span style={{ fontFamily: "var(--display)", fontSize: "24px", color: scoreColor(latest), lineHeight: 1 }}>
              {latest}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", opacity: 0.5 }}>/100</span>
          </div>
        </div>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.45 }}
          style={{
            display: "flex", alignItems: "center", gap: "5px",
            padding: "5px 12px", borderRadius: "999px",
            background: delta >= 0 ? "rgba(170,255,110,0.07)" : "rgba(255,107,107,0.07)",
            border: `1px solid ${delta >= 0 ? "rgba(170,255,110,0.22)" : "rgba(255,107,107,0.22)"}`,
          }}
        >
          <span style={{
            fontFamily: "var(--mono)", fontSize: "12px", letterSpacing: "0.04em",
            color: delta >= 0 ? "var(--success)" : "var(--coral)",
          }}>
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} {Math.abs(delta)} pts
          </span>
        </motion.div>
      </div>

      {/* Chart */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7B6CFF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#7B6CFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7B6CFF" />
            <stop offset="60%" stopColor="#A08FFF" />
            <stop offset="100%" stopColor="#00D9FF" />
          </linearGradient>
          <filter id="dotGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[topY, midY].map((y, gi) => (
          <g key={gi}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 6" />
            <text x={PAD.left - 6} y={y + 3.5}
              fill="rgba(106,103,128,0.4)" fontSize="8.5" textAnchor="end"
              fontFamily="'JetBrains Mono', monospace">
              {Math.round(gi === 0 ? maxScore : minScore + (maxScore - minScore) * 0.5)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Animated line */}
        <motion.path
          d={linePath}
          fill="none" stroke="url(#lineGrad)" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          style={{ filter: "drop-shadow(0 0 5px rgba(123,108,255,0.55))" }}
        />

        {/* Dots */}
        {pts.map((pt, i) => (
          <motion.g key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25 + (i / pts.length) * 1.3, duration: 0.35 }}
            style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
          >
            <circle cx={pt.x} cy={pt.y} r="9" fill={`${scoreColor(pt.score)}14`} />
            <circle cx={pt.x} cy={pt.y} r="5" fill="#060610" stroke={scoreColor(pt.score)} strokeWidth="1.8"
              filter="url(#dotGlow)" />
            <circle cx={pt.x} cy={pt.y} r="2.2" fill={scoreColor(pt.score)} />
          </motion.g>
        ))}

        {/* Labels */}
        {pts.map((pt, i) => (
          <text key={i} x={pt.x} y={H - 5}
            textAnchor="middle" fill="rgba(106,103,128,0.35)"
            fontSize="9" fontFamily="'JetBrains Mono', monospace">
            #{i + 1}
          </text>
        ))}
      </svg>
    </motion.div>
  );
}

/* ── Mini score ring ── */
function MiniRing({ score, color, size = 52 }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * score) / 100;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
      />
    </svg>
  );
}

function SessionCard({ session, onView, index }) {
  const color = scoreColor(session.clarityScore);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onView(session)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        background: hovered ? "rgba(123,108,255,0.05)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${hovered ? "rgba(123,108,255,0.28)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "18px",
        padding: "22px 24px",
        display: "flex", gap: "18px", alignItems: "flex-start",
        cursor: "pointer",
        transition: "background 0.3s, border-color 0.3s",
        overflow: "hidden",
      }}
    >
      {hovered && (
        <div style={{
          position: "absolute", top: -60, left: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(123,108,255,0.1) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
      )}

      {session.clarityScore !== null && (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <MiniRing score={session.clarityScore} color={color} size={52} />
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontFamily: "var(--display)", fontSize: "14px",
              color, lineHeight: 1, transform: "rotate(90deg)",
            }}>{session.clarityScore}</span>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--ui)", fontSize: "14px", color: "var(--text)",
          lineHeight: 1.5, marginBottom: "6px",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {session.situation}
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.05em" }}>
            {timeAgo(session.createdAt)}
          </span>
          <span style={{ width: 2, height: 2, borderRadius: "50%", background: "var(--muted)", opacity: 0.4 }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.05em" }}>
            {Math.ceil(session.turnCount / 2)} exchanges
          </span>
        </div>
        {session.overallVerdict && (
          <div style={{
            marginTop: "10px",
            fontFamily: "var(--mono)", fontSize: "11px", color: "rgba(106,103,128,0.7)",
            lineHeight: 1.55, overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
          }}>
            {session.overallVerdict}
          </div>
        )}
      </div>

      <div style={{
        fontFamily: "var(--mono)", fontSize: "10px", color: "var(--primary)",
        letterSpacing: "0.05em", flexShrink: 0,
        opacity: hovered ? 1 : 0.5, transition: "opacity 0.2s",
      }}>
        →
      </div>
    </motion.div>
  );
}

function PastSessionModal({ session, onClose }) {
  if (!session) return null;
  const d = session.debrief;
  const color = scoreColor(d?.clarityScore);
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, backdropFilter: "blur(16px)", padding: "24px",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0A0A10",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px", padding: "40px",
          maxWidth: "580px", width: "100%", maxHeight: "85vh",
          overflowY: "auto", scrollbarWidth: "none",
          display: "flex", flexDirection: "column", gap: "22px",
          boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "0.15em", marginBottom: "10px" }}>
              {new Date(session.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
            <div style={{ fontFamily: "var(--display)", fontSize: "20px", color: "var(--text)", lineHeight: 1.4 }}>
              {session.situation}
            </div>
          </div>
          {d?.clarityScore !== undefined && (
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ position: "relative", width: 90, height: 90 }}>
                <MiniRing score={d.clarityScore} color={color} size={90} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "var(--display)", fontSize: "28px", color, lineHeight: 1, transform: "rotate(90deg)" }}>{d.clarityScore}</span>
                </div>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--muted)", letterSpacing: "0.12em", marginTop: "4px" }}>CLARITY</div>
            </div>
          )}
        </div>

        <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

        {d?.clarityRationale && (
          <div style={{ fontFamily: "var(--ui)", fontSize: "14px", color: "var(--muted)", lineHeight: 1.7 }}>
            {d.clarityRationale}
          </div>
        )}

        {d?.bestMoment?.quote && (
          <div style={{ padding: "18px 20px", borderRadius: "14px", background: "rgba(200,240,100,0.04)", borderLeft: "2px solid var(--success)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--success)", letterSpacing: "0.14em", marginBottom: "10px" }}>STRONGEST MOMENT</div>
            <div style={{ fontFamily: "var(--display)", fontStyle: "italic", fontSize: "15px", lineHeight: 1.7, marginBottom: "8px" }}>"{d.bestMoment.quote}"</div>
            <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>{d.bestMoment.reason}</div>
          </div>
        )}

        {d?.worstMoment?.quote && (
          <div style={{ padding: "18px 20px", borderRadius: "14px", background: "rgba(255,107,107,0.04)", borderLeft: "2px solid var(--coral)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--coral)", letterSpacing: "0.14em", marginBottom: "10px" }}>CRITICAL STUMBLE</div>
            <div style={{ fontFamily: "var(--display)", fontStyle: "italic", fontSize: "15px", lineHeight: 1.7, marginBottom: "8px" }}>"{d.worstMoment.quote}"</div>
            <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>{d.worstMoment.reason}</div>
          </div>
        )}

        {d?.contentGaps?.length > 0 && (
          <div style={{ padding: "18px 20px", borderRadius: "14px", background: "rgba(245,166,35,0.04)", borderLeft: "2px solid var(--amber)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--amber)", letterSpacing: "0.14em", marginBottom: "12px" }}>CONTENT GAPS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {d.contentGaps.slice(0, 3).map((g, i) => (
                <div key={i} style={{ display: "flex", gap: "10px" }}>
                  <span style={{ color: "var(--amber)", flexShrink: 0, opacity: 0.7 }}>→</span>
                  <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>{g.gap}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {d?.priorityFix && (
          <div style={{ padding: "20px 22px", borderRadius: "14px", background: "rgba(123,108,255,0.05)", border: "1px solid rgba(123,108,255,0.15)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--primary)", letterSpacing: "0.14em", marginBottom: "10px" }}>FOCUS ON THIS</div>
            <div style={{ fontFamily: "var(--display)", fontSize: "17px", lineHeight: 1.6 }}>{d.priorityFix}</div>
          </div>
        )}

        {/* Transcript toggle */}
        {session.history?.length > 0 && (
          <div>
            <button
              onClick={() => setShowTranscript(v => !v)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px", padding: "12px 16px",
                fontFamily: "var(--mono)", fontSize: "10px",
                color: "var(--muted)", letterSpacing: "0.12em",
              }}
            >
              <span>TRANSCRIPT — {session.history.length} TURNS</span>
              <span style={{ opacity: 0.5 }}>{showTranscript ? "▲" : "▼"}</span>
            </button>
            <AnimatePresence>
              {showTranscript && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{
                    display: "flex", flexDirection: "column", gap: "12px",
                    marginTop: "10px", maxHeight: "260px", overflowY: "auto", scrollbarWidth: "none",
                  }}>
                    {session.history.map((turn, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: turn.speaker === "You" ? "var(--amber)" : "var(--teal)", letterSpacing: "0.08em" }}>
                          {turn.speaker.toUpperCase()}
                        </span>
                        <span style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>
                          {turn.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <button onClick={onClose} className="btn btn-ghost" style={{ width: "100%", marginTop: "4px" }}>
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function Dashboard({ user, onNewSession, getIdToken }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    if (!user?.sub) { setLoading(false); return; }
    // Show local sessions instantly while we fetch from server
    setSessions(getLocalSessions(user.sub));
    const load = async () => {
      try {
        const token = await getIdToken();
        const data = await getJSON("/api/sessions", token);
        if (data?.length) setSessions(data);
      } catch {
        // backend unavailable — local sessions already shown
      }
      setLoading(false);
    };
    load();
  }, [user, getIdToken]);

  const avgScore = sessions.length
    ? Math.round(sessions.filter(s => s.clarityScore !== null).reduce((a, s) => a + (s.clarityScore || 0), 0) / Math.max(sessions.filter(s => s.clarityScore !== null).length, 1))
    : null;

  const firstName = user?.given_name || user?.name?.split(" ")[0] || "there";

  return (
    <motion.div className="screen screen-scroll" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "var(--bg)" }}
    >
      <div className="ambient" />
      <div className="noise" />

      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage:
          "linear-gradient(rgba(123,108,255,0.018) 1px, transparent 1px), " +
          "linear-gradient(90deg, rgba(123,108,255,0.018) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 100%)",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        maxWidth: "700px", margin: "0 auto", width: "100%",
        padding: "56px 24px 100px",
        display: "flex", flexDirection: "column", gap: "24px",
      }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 12px var(--primary-glow)" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: "0.3em" }}>SWARM AI</span>
            </div>
            <h1 style={{ fontFamily: "var(--display)", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 300, lineHeight: 1.15 }}>
              Welcome back,<br />
              <em style={{
                fontStyle: "italic",
                background: "linear-gradient(135deg, #7B6CFF 0%, #00D9FF 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>{firstName}</em>
            </h1>
          </div>
          {user?.picture && (
            <img
              src={user.picture} alt="" width={48} height={48}
              referrerPolicy="no-referrer"
              style={{
                borderRadius: "50%",
                border: "1px solid rgba(123,108,255,0.3)",
                boxShadow: "0 0 20px rgba(123,108,255,0.15)",
                flexShrink: 0,
              }}
            />
          )}
        </motion.div>

        {/* Stats row */}
        {!loading && sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{ display: "flex", gap: "12px" }}
          >
            {[
              { label: "Sessions", value: sessions.length, color: "var(--primary)" },
              { label: "Avg Score", value: avgScore ?? "—", color: scoreColor(avgScore) },
              { label: "Exchanges", value: sessions.reduce((a, s) => a + Math.ceil(s.turnCount / 2), 0), color: "var(--teal)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                flex: 1, padding: "16px 18px",
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "14px",
                backdropFilter: "blur(12px)",
                position: "relative", overflow: "hidden",
              }}>
                {/* 3D depth layer */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%)",
                  borderRadius: "14px",
                  pointerEvents: "none",
                }} />
                <div style={{ fontFamily: "var(--display)", fontSize: "28px", color, lineHeight: 1, marginBottom: "4px" }}>{value}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--muted)", letterSpacing: "0.12em" }}>{label.toUpperCase()}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Score trend graph */}
        {!loading && <TrendGraph sessions={sessions} />}

        {/* New session CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.55 }}
        >
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            className="btn btn-primary"
            onClick={onNewSession}
            style={{
              width: "100%", height: "auto",
              padding: "26px 28px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderRadius: "20px",
              fontSize: "15px",
              position: "relative", overflow: "hidden",
            }}
          >
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.06) 75%, transparent 75%)",
              backgroundSize: "40px 40px",
              opacity: 0.3,
            }} />
            {/* Shine on top edge */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
            }} />
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
              <span style={{ fontFamily: "var(--display)", fontSize: "20px", fontWeight: 400 }}>Launch New Session</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: "11px", opacity: 0.6, fontWeight: 400, letterSpacing: "0.06em" }}>
                5 AI agents · live voice · adaptive debrief
              </span>
            </div>
            <div style={{
              position: "relative",
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.12) inset",
            }}>→</div>
          </motion.button>
        </motion.div>

        {/* Past sessions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "rgba(106,103,128,0.5)", letterSpacing: "0.18em" }}>
              {loading ? "LOADING..." : sessions.length > 0 ? `PAST SESSIONS — ${sessions.length}` : "NO SESSIONS YET"}
            </span>
          </div>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2 }}
                  style={{
                    height: "90px", borderRadius: "18px",
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                />
              ))}
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                padding: "60px 24px", borderRadius: "20px",
                background: "rgba(255,255,255,0.018)",
                border: "1px dashed rgba(255,255,255,0.07)",
                textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "rgba(123,108,255,0.08)",
                border: "1px solid rgba(123,108,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px", color: "var(--primary)",
              }}>◎</div>
              <div style={{ fontFamily: "var(--display)", fontSize: "20px", color: "var(--text-2)" }}>No sessions yet</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "rgba(106,103,128,0.5)", maxWidth: "280px", lineHeight: 1.65 }}>
                Complete your first practice to see your performance history here.
              </div>
            </motion.div>
          )}

          {!loading && sessions.map((s, i) => (
            <SessionCard key={s.id} session={s} onView={setViewing} index={i} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {viewing && <PastSessionModal session={viewing} onClose={() => setViewing(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}
