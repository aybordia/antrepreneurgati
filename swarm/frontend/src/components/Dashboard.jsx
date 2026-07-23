import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getJSON } from "../lib/api";
import { getSessions as getLocalSessions } from "../lib/localSessions";

const sv = {
  initial: { opacity: 0, filter: "blur(10px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, filter: "blur(8px)", transition: { duration: 0.35 } },
};

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

const honeyCell = (a) => `color-mix(in srgb, var(--honey) ${Math.round(a * 100)}%, transparent)`;

/* ── Practice activity (16-week grid) — non-scored, just showing up ── */
function PracticeHeatmap({ sessions }) {
  const [tooltip, setTooltip] = useState(null);
  const WEEKS = 16;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const counts = {};
  sessions.forEach(s => {
    const d = new Date(s.createdAt);
    d.setHours(0, 0, 0, 0);
    counts[d.getTime()] = (counts[d.getTime()] || 0) + 1;
  });

  const days = [];
  for (let i = WEEKS * 7 - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({ date: d, count: counts[d.getTime()] || 0 });
  }
  const maxCount = Math.max(...Object.values(counts), 1);

  const cols = [];
  for (let w = 0; w < WEEKS; w++) cols.push(days.slice(w * 7, (w + 1) * 7));

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthLabels = [];
  cols.forEach((week, wi) => {
    const first = week[0].date;
    const prev = wi > 0 ? cols[wi - 1][0].date : null;
    if (!prev || first.getMonth() !== prev.getMonth()) monthLabels.push({ wi, label: MONTHS[first.getMonth()] });
  });

  const activeDays = Object.values(counts).filter(c => c > 0).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.55 }}
      className="card"
      style={{ padding: "22px 24px 18px", background: "var(--surface)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--dim)", letterSpacing: "0.18em", marginBottom: 8 }}>
            PRACTICE ACTIVITY
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "var(--display)", fontSize: 30, color: "var(--honey)", lineHeight: 1 }}>{activeDays}</span>
            <span style={{ fontFamily: "var(--ui)", fontSize: 16, color: "var(--dim)" }}>
              {activeDays === 1 ? "day practised" : "days practised"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)" }}>less</span>
          {[0, 0.3, 0.55, 0.8, 1].map((v, i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: v === 0 ? "var(--raised)" : honeyCell(0.2 + v * 0.8) }} />
          ))}
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)" }}>more</span>
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 5, height: 12 }}>
        {monthLabels.map(({ wi, label }) => (
          <span key={wi} style={{ position: "absolute", left: wi * 15, fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)" }}>{label}</span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 3 }}>
        {cols.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {week.map((day, di) => {
              const isToday = day.date.getTime() === today.getTime();
              const intensity = day.count > 0 ? Math.min(1, 0.28 + (day.count / maxCount) * 0.72) : 0;
              const dateStr = day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <div key={di}
                  onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, date: dateStr, count: day.count })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    width: 11, height: 11, borderRadius: 3,
                    background: day.count === 0 ? "var(--raised)" : honeyCell(intensity),
                    outline: isToday ? "1px solid var(--honey)" : "none", outlineOffset: -1,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 12, top: tooltip.y - 36,
          background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 8,
          padding: "5px 10px", pointerEvents: "none", zIndex: 999, display: "flex", gap: 6, alignItems: "center",
        }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--dim)" }}>{tooltip.date}</span>
          <span style={{ width: 1, height: 10, background: "var(--line)" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: tooltip.count > 0 ? "var(--honey)" : "var(--dim)" }}>
            {tooltip.count} {tooltip.count === 1 ? "session" : "sessions"}
          </span>
        </div>
      )}
    </motion.div>
  );
}

function calcStreak(sessions) {
  if (!sessions.length) return 0;
  const key = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = new Set(sessions.map(s => key(new Date(s.createdAt))));
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (!days.has(key(today)) && !days.has(key(yesterday))) return 0;
  let streak = 0;
  let cur = days.has(key(today)) ? new Date(today) : new Date(yesterday);
  while (days.has(key(cur))) { streak++; cur = new Date(cur.getTime() - 86400000); }
  return streak;
}

function StatTile({ value, label, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="card"
      style={{ padding: "18px 20px", background: "var(--surface)" }}
    >
      <div style={{ fontFamily: "var(--display)", fontSize: 34, color: "var(--honey)", lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--dim)", letterSpacing: "0.12em" }}>{label}</div>
    </motion.div>
  );
}

function SessionCard({ session, onView, index }) {
  const [hovered, setHovered] = useState(false);
  const exchanges = session.turnCount ? Math.ceil(session.turnCount / 2) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onView(session)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="card"
      style={{
        padding: "20px 24px", display: "flex", gap: 18, alignItems: "center", cursor: "pointer",
        borderColor: hovered ? "rgba(228,163,57,0.4)" : "var(--line)",
        background: hovered ? "var(--honey-soft)" : "var(--surface)",
        transition: "background 0.25s, border-color 0.25s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--ui)", fontSize: 19, color: "var(--text)", lineHeight: 1.45, marginBottom: 6,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {session.situation}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--dim)" }}>{timeAgo(session.createdAt)}</span>
          {exchanges != null && (
            <>
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--dim)" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--dim)" }}>
                {exchanges} {exchanges === 1 ? "exchange" : "exchanges"}
              </span>
            </>
          )}
        </div>
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 18, color: "var(--honey)", flexShrink: 0, opacity: hovered ? 1 : 0.5, transition: "opacity 0.2s" }}>→</span>
    </motion.div>
  );
}

function ModalBlock({ label, accent = "var(--honey)", children }) {
  return (
    <div style={{ padding: "18px 20px", borderRadius: 14, background: "var(--surface)", borderLeft: `2px solid ${accent}` }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: accent, letterSpacing: "0.14em", marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

function PastSessionModal({ session, onClose }) {
  const [showTranscript, setShowTranscript] = useState(false);
  if (!session) return null;
  const d = session.debrief || {};
  const impressions = Array.isArray(d.persona_impressions) ? d.persona_impressions : [];
  const observations = Array.isArray(d.communication_observations) ? d.communication_observations : [];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(12px)", padding: 24 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="card"
        style={{ background: "var(--ink)", borderRadius: 24, padding: 36, maxWidth: 600, width: "100%", maxHeight: "85vh", overflowY: "auto", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 20 }}
      >
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--dim)", letterSpacing: "0.15em", marginBottom: 10 }}>
            {new Date(session.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
          <div style={{ fontFamily: "var(--display)", fontSize: 24, color: "var(--text)", lineHeight: 1.35 }}>{session.situation}</div>
        </div>

        <div style={{ height: 1, background: "var(--line)" }} />

        {impressions.map((im, i) => (
          <ModalBlock key={i} label={(im.persona || "The panel").toUpperCase()} accent="var(--calm)">
            <div style={{ fontFamily: "var(--ui)", fontSize: 18, color: "var(--text-2)", lineHeight: 1.65 }}>{im.impression}</div>
          </ModalBlock>
        ))}

        {observations.map((o, i) => (
          <ModalBlock key={`obs-${i}`} label={(o.dimension || "Observation").toUpperCase()}>
            <div style={{ fontFamily: "var(--ui)", fontSize: 18, color: "var(--text-2)", lineHeight: 1.65 }}>{o.observation}</div>
            {o.suggestion && (
              <div style={{ fontFamily: "var(--ui)", fontSize: 17, color: "var(--dim)", lineHeight: 1.6, marginTop: 8 }}>{o.suggestion}</div>
            )}
          </ModalBlock>
        ))}

        {d.focus && (
          <ModalBlock label="FOCUS NEXT TIME">
            <div style={{ fontFamily: "var(--display)", fontSize: 21, color: "var(--text)", lineHeight: 1.55 }}>{d.focus}</div>
          </ModalBlock>
        )}

        {/* Legacy positive fields from older saved sessions (never scored, never harsh) */}
        {d.bestMoment?.quote && (
          <ModalBlock label="A STRONG MOMENT" accent="var(--calm)">
            <div style={{ fontFamily: "var(--display)", fontStyle: "italic", fontSize: 20, lineHeight: 1.65, marginBottom: 8, color: "var(--text)" }}>&ldquo;{d.bestMoment.quote}&rdquo;</div>
            <div style={{ fontFamily: "var(--ui)", fontSize: 17, color: "var(--dim)", lineHeight: 1.6 }}>{d.bestMoment.reason}</div>
          </ModalBlock>
        )}

        {!impressions.length && !observations.length && !d.focus && !d.bestMoment?.quote && (
          <div style={{ fontFamily: "var(--ui)", fontSize: 18, color: "var(--dim)", lineHeight: 1.65 }}>
            Your full transcript is below — re-reading your own answers is one of the most useful ways to review.
          </div>
        )}

        {session.history?.length > 0 && (
          <div>
            <button onClick={() => setShowTranscript(v => !v)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 16px", fontFamily: "var(--mono)", fontSize: 13, color: "var(--dim)", letterSpacing: "0.12em", cursor: "pointer" }}>
              <span>TRANSCRIPT · {session.history.length} TURNS</span>
              <span aria-hidden style={{ opacity: 0.6 }}>{showTranscript ? "▲" : "▼"}</span>
            </button>
            <AnimatePresence>
              {showTranscript && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} style={{ overflow: "hidden" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10, maxHeight: 260, overflowY: "auto", scrollbarWidth: "none" }}>
                    {session.history.map((turn, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: turn.speaker === "You" ? "var(--honey)" : "var(--calm)", letterSpacing: "0.08em" }}>{turn.speaker.toUpperCase()}</span>
                        <span style={{ fontFamily: "var(--ui)", fontSize: 17, color: "var(--text-2)", lineHeight: 1.6 }}>{turn.text}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <button onClick={onClose} className="btn btn-ghost" style={{ width: "100%", marginTop: 4 }}>Close</button>
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
    setSessions(getLocalSessions(user.sub));
    const load = async () => {
      try {
        const token = await getIdToken();
        const data = await getJSON("/api/sessions", token);
        if (data?.length) setSessions(data);
      } catch { /* backend unavailable — local sessions already shown */ }
      setLoading(false);
    };
    load();
  }, [user, getIdToken]);

  const streak = calcStreak(sessions);
  const topics = new Set(sessions.map(s => (s.situation || "").trim().toLowerCase()).filter(Boolean)).size;
  const firstName = user?.given_name || user?.name?.split(" ")[0] || "there";

  return (
    <motion.div className="screen screen-scroll" variants={sv} initial="initial" animate="animate" exit="exit" style={{ background: "var(--bg)" }}>
      <div className="ambient" />
      <div className="noise" />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto", width: "100%", padding: "56px 24px 100px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <img src="/logo.png" alt="Swarm AI logo" width={32} height={32} style={{ display: "block" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--dim)", letterSpacing: "0.3em" }}>SWARM AI</span>
            </div>
            <h1 style={{ fontFamily: "var(--display)", fontSize: "clamp(40px, 6.5vw, 60px)", fontWeight: 400, lineHeight: 1.12 }}>
              Welcome back,<br />
              <span style={{ color: "var(--honey)" }}>{firstName}</span>
            </h1>
          </div>
          {user?.picture && (
            <img src={user.picture} alt="" width={48} height={48} referrerPolicy="no-referrer"
              style={{ borderRadius: "50%", border: "1px solid var(--line)", flexShrink: 0 }} />
          )}
        </motion.div>

        {/* Non-scored progress */}
        {!loading && sessions.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <StatTile value={sessions.length} label="SESSIONS" delay={0.06} />
            <StatTile value={topics} label={topics === 1 ? "TOPIC" : "TOPICS"} delay={0.12} />
            <StatTile value={streak} label={streak === 1 ? "DAY STREAK" : "DAY STREAK"} delay={0.18} />
          </div>
        )}

        {!loading && sessions.length > 0 && <PracticeHeatmap sessions={sessions} />}

        {/* New session CTA */}
        <motion.button
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.55 }}
          whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
          className="btn btn-primary"
          onClick={onNewSession}
          style={{ width: "100%", height: "auto", padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 20, gap: 16 }}
        >
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <span style={{ fontFamily: "var(--display)", fontSize: 23, fontWeight: 500 }}>Start a new session</span>
            <span style={{ fontFamily: "var(--ui)", fontSize: 16, opacity: 0.75, fontWeight: 400 }}>
              Interview, casual chat, or practise with a person
            </span>
          </span>
          <span aria-hidden style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>→</span>
        </motion.button>

        {/* Past sessions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--dim)", letterSpacing: "0.18em" }}>
            {loading ? "LOADING…" : sessions.length > 0 ? `PAST SESSIONS (${sessions.length})` : "YOUR SESSIONS"}
          </span>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map(i => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2 }}
                  style={{ height: 84, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--line)" }} />
              ))}
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card"
              style={{ padding: "56px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, borderStyle: "dashed", background: "transparent" }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 24, color: "var(--text-2)" }}>No sessions yet</div>
              <div style={{ fontFamily: "var(--ui)", fontSize: 17, color: "var(--dim)", maxWidth: 300, lineHeight: 1.6 }}>
                Start your first practice — it'll show up here so you can revisit it anytime.
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
