import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DailyIframe from "@daily-co/daily-js";
import { postJSON, getJSON } from "../lib/api";

const ACCENT = "#8FB6E8";
const AGREEMENT_KEY = "swarm_peer_agreement_v1";
const HANDLE_KEY = "swarm_peer_handle";

const sv = {
  initial: { opacity: 0, filter: "blur(10px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, filter: "blur(8px)", transition: { duration: 0.3 } },
};

const POLL_MS = 2500;

export default function PeerSession({ getIdToken, onExit }) {
  // agreement | setup | waiting | call | ended
  const [step, setStep] = useState(() =>
    localStorage.getItem(AGREEMENT_KEY) ? "setup" : "agreement");
  const [handle, setHandle] = useState(() => localStorage.getItem(HANDLE_KEY) || "");
  const [mode, setMode] = useState("conversation");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState(null);
  const [match, setMatch] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [notice, setNotice] = useState(null);

  const pollRef = useRef(null);
  const callFrameRef = useRef(null);
  const callContainerRef = useRef(null);
  const unmountedRef = useRef(false);

  const stopPolling = () => { clearInterval(pollRef.current); pollRef.current = null; };

  const cleanupCall = useCallback(() => {
    if (callFrameRef.current) {
      try { callFrameRef.current.leave(); } catch { /* already left */ }
      try { callFrameRef.current.destroy(); } catch { /* already destroyed */ }
      callFrameRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    unmountedRef.current = true;
    stopPolling();
    cleanupCall();
  }, [cleanupCall]);

  // ── Matching ────────────────────────────────────────────────────────────────
  const joinQueue = async () => {
    setError(null);
    const cleanHandle = handle.trim();
    if (!cleanHandle) { setError("Choose a display name first. It doesn't have to be your real name."); return; }
    localStorage.setItem(HANDLE_KEY, cleanHandle);

    try {
      const token = await getIdToken();
      const result = await postJSON("/api/peer/queue", { handle: cleanHandle, mode, topic }, token);
      if (result.status === "matched") {
        setMatch(result);
        setStep("call");
      } else {
        setStep("waiting");
        pollRef.current = setInterval(async () => {
          try {
            const s = await getJSON("/api/peer/status", await getIdToken());
            if (s.status === "matched") {
              stopPolling();
              if (!unmountedRef.current) { setMatch(s); setStep("call"); }
            }
            if (s.status === "idle") { stopPolling(); if (!unmountedRef.current) setStep("setup"); }
          } catch { /* transient poll failure — keep polling */ }
        }, POLL_MS);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const cancelWaiting = async () => {
    stopPolling();
    try { await postJSON("/api/peer/cancel", {}, await getIdToken()); } catch { /* best effort */ }
    setStep("setup");
  };

  // ── Call lifecycle ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "call" || !match?.room?.url || !callContainerRef.current) return;
    const frame = DailyIframe.createFrame(callContainerRef.current, {
      showLeaveButton: true,
      showFullscreenButton: true,
      userName: handle.trim() || "Practice partner",
      iframeStyle: {
        width: "100%", height: "100%", border: "0", borderRadius: "14px",
      },
    });
    callFrameRef.current = frame;
    frame.join({ url: match.room.url, startVideoOff: true });
    frame.on("left-meeting", () => { if (!unmountedRef.current) endSession(); });
    return () => cleanupCall();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, match]);

  const endSession = async () => {
    cleanupCall();
    try { await postJSON("/api/peer/end", {}, await getIdToken()); } catch { /* best effort */ }
    setStep("ended");
  };

  const submitReport = async () => {
    if (!reportReason.trim()) return;
    try {
      const r = await postJSON("/api/peer/report", {
        reportedId: match?.partnerId, matchId: match?.matchId, reason: reportReason,
      }, await getIdToken());
      setNotice(r.message || "Report received.");
      setShowReport(false);
      setReportReason("");
    } catch (e) { setError(e.message); }
  };

  const blockPartner = async () => {
    try {
      const r = await postJSON("/api/peer/block", { blockedId: match?.partnerId }, await getIdToken());
      setNotice(r.message || "Blocked.");
      endSession();
    } catch (e) { setError(e.message); }
  };

  // ── Shared chrome ───────────────────────────────────────────────────────────
  const Shell = ({ children, wide = false }) => (
    <motion.div className="screen screen-scroll" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "var(--ink)" }}>
      <div className="noise" />
      <div style={{
        position: "relative", zIndex: 1, minHeight: "100%",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "80px 24px 48px", maxWidth: wide ? 980 : 560, margin: "0 auto", gap: 20, width: "100%",
      }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: ACCENT, letterSpacing: "0.16em", alignSelf: "flex-start" }}>
          PRACTICE WITH A PERSON
        </div>
        {children}
        {error && (
          <div style={{
            width: "100%", padding: "12px 16px", borderRadius: 10,
            background: "rgba(217,139,139,0.07)", border: "1px solid rgba(217,139,139,0.25)",
            fontFamily: "var(--ui)", fontSize: 13, color: "var(--alert)", lineHeight: 1.6,
          }}>{error}</div>
        )}
        {notice && (
          <div style={{
            width: "100%", padding: "12px 16px", borderRadius: 10,
            background: "var(--calm-soft)", border: "1px solid rgba(116,185,160,0.3)",
            fontFamily: "var(--ui)", fontSize: 13, color: "var(--calm)", lineHeight: 1.6,
          }}>{notice}</div>
        )}
      </div>
    </motion.div>
  );

  // ── Steps ───────────────────────────────────────────────────────────────────
  if (step === "agreement") {
    return (
      <Shell>
        <h1 style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(26px, 4vw, 34px)", lineHeight: 1.2 }}>
          Before you practice with a real person.
        </h1>
        <div className="card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          {[
            "Be respectful. The other person is practicing too, on their own terms.",
            "No recording of any kind without the other person's clear consent. Swarm never records these sessions.",
            "Your camera and microphone are each optional and off or on only when you choose.",
            "You can end any session at any moment, with no explanation needed.",
            "Report and block are always one tap away, during and after a session.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: ACCENT, fontSize: 13, lineHeight: 1.6 }}>·</span>
              <span style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 14, color: "var(--text-2)", lineHeight: 1.65 }}>{line}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button className="btn btn-primary" style={{ flex: 1, fontSize: 14 }}
            onClick={() => { localStorage.setItem(AGREEMENT_KEY, String(Date.now())); setStep("setup"); }}>
            I understand
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, height: 50 }} onClick={onExit}>Go back</button>
        </div>
      </Shell>
    );
  }

  if (step === "setup") {
    return (
      <Shell>
        <h1 style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(26px, 4vw, 34px)", lineHeight: 1.2 }}>
          Find a practice partner.
        </h1>
        <p style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 14, color: "var(--dim)", lineHeight: 1.7, alignSelf: "flex-start" }}>
          You'll be matched with another person who picked the same kind of practice. Cameras start off for both of you.
        </p>

        <label style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)", letterSpacing: "0.12em" }}>
            DISPLAY NAME (NOT YOUR REAL NAME UNLESS YOU WANT)
          </span>
          <input
            value={handle}
            onChange={e => setHandle(e.target.value)}
            maxLength={24}
            placeholder="e.g. QuietFox"
            style={{
              width: "100%", background: "var(--surface)", border: "1px solid var(--line)",
              borderRadius: 10, padding: "14px 16px", fontSize: 14, fontFamily: "var(--ui)",
              color: "var(--text)", outline: "none",
            }}
          />
        </label>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)", letterSpacing: "0.12em" }}>
            KIND OF PRACTICE
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {[["conversation", "Casual conversation"], ["interview", "Interview practice"]].map(([key, label]) => (
              <button key={key} onClick={() => setMode(key)} aria-pressed={mode === key}
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                  background: mode === key ? "rgba(143,182,232,0.12)" : "var(--surface)",
                  border: `1px solid ${mode === key ? "rgba(143,182,232,0.5)" : "var(--line)"}`,
                  fontFamily: "var(--ui)", fontSize: 13.5,
                  color: mode === key ? ACCENT : "var(--dim)", transition: "all 0.2s",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <label style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)", letterSpacing: "0.12em" }}>
            TOPIC (OPTIONAL)
          </span>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            maxLength={80}
            placeholder="e.g. college interviews, favorite games, weekend plans"
            style={{
              width: "100%", background: "var(--surface)", border: "1px solid var(--line)",
              borderRadius: 10, padding: "14px 16px", fontSize: 14, fontFamily: "var(--ui)",
              color: "var(--text)", outline: "none",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button className="btn btn-primary" style={{ flex: 1, fontSize: 14 }} onClick={joinQueue}>
            Find a partner
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, height: 50 }} onClick={onExit}>Go back</button>
        </div>
      </Shell>
    );
  }

  if (step === "waiting") {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%", padding: "40px 0" }}>
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 64, height: 64, borderRadius: "50%",
              border: `2px solid ${ACCENT}`, background: "rgba(143,182,232,0.1)",
            }}
          />
          <div style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: 22 }}>
            Waiting for a partner…
          </div>
          <p style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 13.5, color: "var(--dim)", lineHeight: 1.7, textAlign: "center", maxWidth: 380 }}>
            You'll be matched with the next person who chooses {mode === "interview" ? "interview practice" : "casual conversation"}.
            You can cancel any time; nothing happens without you.
          </p>
          <button className="btn btn-ghost" onClick={cancelWaiting} style={{ fontSize: 13 }}>
            Cancel and go back
          </button>
        </div>
      </Shell>
    );
  }

  if (step === "call") {
    return (
      <Shell wide>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 14, color: "var(--text-2)" }}>
            You're practicing with <strong style={{ fontWeight: 500, color: ACCENT }}>{match?.partnerHandle || "your partner"}</strong>.
            Camera and mic controls are inside the call. Not recorded.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" style={{ height: 34, fontSize: 12 }} onClick={() => setShowReport(true)}>Report</button>
            <button className="btn btn-ghost" style={{ height: 34, fontSize: 12 }} onClick={blockPartner}>Block</button>
            <button className="btn btn-ghost" style={{ height: 34, fontSize: 12 }} onClick={endSession}>End session</button>
          </div>
        </div>

        <div ref={callContainerRef} style={{
          width: "100%", height: "min(62vh, 640px)", borderRadius: 14,
          background: "var(--surface)", border: "1px solid var(--line)", overflow: "hidden",
        }} />

        <AnimatePresence>
          {showReport && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "fixed", inset: 0, background: "rgba(8,10,16,0.85)", zIndex: 100,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <div className="card" style={{ background: "var(--surface)", padding: 28, maxWidth: 420, width: "92%", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 19 }}>Report this session</div>
                <textarea
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  rows={4}
                  placeholder="What happened? A sentence is enough."
                  style={{
                    width: "100%", background: "var(--ink)", border: "1px solid var(--line)",
                    borderRadius: 10, padding: "12px 14px", fontSize: 13.5, fontFamily: "var(--ui)",
                    color: "var(--text)", outline: "none", resize: "none", lineHeight: 1.6,
                  }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={submitReport}>Send report</button>
                  <button className="btn btn-ghost" style={{ flex: 1, height: 50 }} onClick={() => setShowReport(false)}>Cancel</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Shell>
    );
  }

  // ended
  return (
    <Shell>
      <h1 style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(24px, 4vw, 32px)" }}>
        Session ended.
      </h1>
      <p style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 14, color: "var(--dim)", lineHeight: 1.7 }}>
        Nothing was recorded. If anything felt off, you can still report or block your partner from here.
      </p>
      <div style={{ display: "flex", gap: 10, width: "100%", flexWrap: "wrap" }}>
        <button className="btn btn-primary" style={{ flex: 1, fontSize: 14 }} onClick={() => setStep("setup")}>
          Find another partner
        </button>
        <button className="btn btn-ghost" style={{ flex: 1, height: 50 }} onClick={() => setShowReport(true)}>Report</button>
        <button className="btn btn-ghost" style={{ flex: 1, height: 50 }} onClick={blockPartner}>Block</button>
        <button className="btn btn-ghost" style={{ flex: 1, height: 50 }} onClick={onExit}>Done</button>
      </div>
      <AnimatePresence>
        {showReport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, background: "rgba(8,10,16,0.85)", zIndex: 100,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <div className="card" style={{ background: "var(--surface)", padding: 28, maxWidth: 420, width: "92%", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 19 }}>Report this session</div>
              <textarea
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                rows={4}
                placeholder="What happened? A sentence is enough."
                style={{
                  width: "100%", background: "var(--ink)", border: "1px solid var(--line)",
                  borderRadius: 10, padding: "12px 14px", fontSize: 13.5, fontFamily: "var(--ui)",
                  color: "var(--text)", outline: "none", resize: "none", lineHeight: 1.6,
                }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={submitReport}>Send report</button>
                <button className="btn btn-ghost" style={{ flex: 1, height: 50 }} onClick={() => setShowReport(false)}>Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
