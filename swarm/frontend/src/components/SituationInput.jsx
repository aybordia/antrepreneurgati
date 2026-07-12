import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Microphone, Stop, CircleNotch } from "@phosphor-icons/react";
import { useElevenLabsSTT } from "../hooks/useElevenLabsSTT";
import { postJSON } from "../lib/api";
import { speakText } from "../hooks/useVoiceOutput";

// Neutral product voice for the setup assistant (not a persona)
const SETUP_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

const EXAMPLES = [
  { label: "Stanford medical interview in 2 days with 4 professors", tag: "Medical" },
  { label: "MIT computer science interview next week, 3 interviewers", tag: "Admissions" },
  { label: "Software engineering internship interview at a startup", tag: "Engineering" },
  { label: "Brown history program interview, 2 professors, in 5 days", tag: "Humanities" },
];

const CONVO_EXAMPLES = [
  { label: "Small talk practice, like chatting before class starts", tag: "Small talk" },
  { label: "Talking about my week and weekend plans", tag: "Everyday" },
  { label: "Chatting about video games and what I'm playing", tag: "Interests" },
  { label: "Practicing meeting someone new for the first time", tag: "Meeting people" },
];

const TONES = [
  { key: "supportive", label: "Supportive", desc: "Interviewers are warm, patient, and encouraging." },
  { key: "neutral", label: "Neutral", desc: "Interviewers are professional and even. A realistic default." },
  { key: "challenging", label: "Challenging", desc: "Interviewers may be more direct and less accommodating, with brisk follow-ups." },
];

const SUPPORT_LEVELS = [
  { key: "guided", label: "Guided", desc: "Questions stay visible on screen with what a full answer usually includes. One part at a time, and asking for clarification is always welcomed. Based on adapted-interview research." },
  { key: "standard", label: "Standard", desc: "Questions stay visible on screen, without the extra breakdown." },
  { key: "realistic", label: "Realistic", desc: "Spoken questions only, natural follow-ups. For practicing transfer to real interviews once Guided feels comfortable." },
];

const sv = {
  initial: { opacity: 0, scale: 0.99, filter: "blur(10px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 1.005, filter: "blur(8px)", transition: { duration: 0.35 } },
};

export default function SituationInput({ onLaunch, onBack, initialSituation = "", getIdToken, mode = "interview" }) {
  const isConvo = mode === "conversation";
  const examples = isConvo ? CONVO_EXAMPLES : EXAMPLES;
  const [situation, setSituation] = useState(initialSituation);
  const [tone, setTone] = useState("neutral");
  const [supportLevel, setSupportLevel] = useState("guided"); // research-backed default: start supported, fade later
  const [resumeContext, setResumeContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [timedMode, setTimedMode] = useState(false);
  const [exIdx, setExIdx] = useState(0);
  const [launchPhase, setLaunchPhase] = useState("idle"); // idle | parsing | clarifying | launching
  const [clarifyQuestion, setClarifyQuestion] = useState("");
  const [previewIntent, setPreviewIntent] = useState(null);

  // When set, the next STT result answers the clarifying question instead of
  // filling the situation textarea
  const clarifyResolveRef = useRef(null);

  const { start, stop, isListening, isProcessing, micError } = useElevenLabsSTT({
    onResult: (t) => {
      if (clarifyResolveRef.current) {
        const resolve = clarifyResolveRef.current;
        clarifyResolveRef.current = null;
        resolve(t);
      } else {
        setSituation(t);
      }
    },
    silenceThresholdMs: Infinity,
  });

  useEffect(() => {
    const id = setInterval(() => setExIdx(i => (i + 1) % EXAMPLES.length), 4500);
    return () => clearInterval(id);
  }, []);

  const canLaunch = situation.trim().length >= 10 && launchPhase === "idle";

  const skipClarify = () => {
    if (clarifyResolveRef.current) {
      const resolve = clarifyResolveRef.current;
      clarifyResolveRef.current = null;
      stop();
      resolve("");
    }
  };

  const handleLaunch = async () => {
    if (!canLaunch) return;
    const finalText = resumeContext.trim()
      ? `${situation.trim()}\n\n[Candidate background: ${resumeContext.trim()}]`
      : situation.trim();

    // Conversation mode: no structured intent needed — launch straight in
    if (isConvo) {
      setLaunchPhase("launching");
      onLaunch(finalText, { timedMode: false, intent: null, tone: null });
      return;
    }

    let intent = null;
    setLaunchPhase("parsing");
    try {
      const token = await getIdToken?.();
      ({ intent } = await postJSON("/api/parse-intent", { transcript: finalText }, token));
      setPreviewIntent(intent);

      // Ask exactly one clarifying follow-up, by voice, if the domain is ambiguous
      if (intent?.clarifying_question) {
        setClarifyQuestion(intent.clarifying_question);
        setLaunchPhase("clarifying");
        const audio = await speakText({ text: intent.clarifying_question, voiceId: SETUP_VOICE_ID });
        if (audio && typeof audio.play === "function") {
          await new Promise(r => { audio.onended = r; audio.onerror = r; audio.play().catch(r); });
        }
        const answer = await new Promise((resolve) => {
          clarifyResolveRef.current = resolve;
          start();
        });
        setClarifyQuestion("");
        if (answer?.trim()) {
          setLaunchPhase("parsing");
          try {
            ({ intent } = await postJSON("/api/parse-intent", {
              transcript: finalText, priorIntent: intent, clarifyingAnswer: answer,
            }, token));
            setPreviewIntent(intent);
          } catch { /* keep first-pass intent */ }
        }
      }
    } catch (e) {
      console.error("[intent] parse failed. Launching without structured intent:", e);
    }
    setLaunchPhase("launching");
    onLaunch(finalText, { timedMode, intent, tone, supportLevel });
  };

  const intentChips = previewIntent ? [
    previewIntent.institution && { label: previewIntent.institution },
    previewIntent.program_type && { label: previewIntent.program_type },
    previewIntent.domain && previewIntent.domain !== "general" && { label: `${previewIntent.domain} questions` },
    previewIntent.num_interviewers && { label: `${previewIntent.num_interviewers} interviewers` },
    previewIntent.timeframe_days != null && { label: `in ${previewIntent.timeframe_days} day${previewIntent.timeframe_days === 1 ? "" : "s"}` },
  ].filter(Boolean) : [];

  return (
    <motion.div className="screen screen-scroll" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "var(--ink)" }}>
      <div className="ambient" />
      <div className="noise" />

      <div style={{
        position: "relative", zIndex: 10, minHeight: "100%",
        display: "flex", alignItems: "center",
        padding: "72px 24px 48px",
      }}>
        <div style={{
          width: "100%", maxWidth: 620, margin: "0 auto",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span aria-hidden style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--honey)",
              }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 16, letterSpacing: "0.35em", color: "var(--dim)", textTransform: "uppercase" }}>
                Swarm AI {isConvo ? "· Conversation" : "· Interview"}
              </span>
            </div>

            <div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                style={{
                  fontFamily: "var(--display)", fontWeight: 400,
                  fontSize: "clamp(42px, 6.5vw, 64px)", lineHeight: 1.12, marginBottom: 12,
                }}
              >
                {isConvo ? <>What would you<br />like to talk about?</> : <>Tell us about<br />your interview.</>}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
                style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 20, color: "var(--dim)", lineHeight: 1.7, maxWidth: 460 }}
              >
                {isConvo
                  ? "Anything at all. This is relaxed practice with one friendly AI partner: no questions to get through, no evaluation, end whenever you like."
                  : "Say it or type it: where, what for, how many interviewers. We'll build a fictional panel and a question plan you can see before you start."}
              </motion.p>
            </div>

            {/* Input console */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.55 }}
              style={{ position: "relative" }}
            >
              {/* Persistent label: never a disappearing placeholder-as-label */}
              <label htmlFor="situation-input" style={{
                display: "block", fontFamily: "var(--mono)", fontSize: 14,
                color: "var(--dim)", letterSpacing: "0.12em", marginBottom: 8,
              }}>
                {isConvo ? "WHAT YOU'D LIKE TO TALK ABOUT" : "YOUR INTERVIEW, IN YOUR OWN WORDS"}
              </label>
              <textarea
                id="situation-input"
                value={situation}
                onChange={e => { if (!isListening && !isProcessing) setSituation(e.target.value); }}
                placeholder={
                  isListening   ? "Listening. Speak whenever you're ready…" :
                  isProcessing  ? "Writing down what you said…" :
                  isConvo       ? "e.g. small talk practice, or chatting about my week" :
                  "e.g. Stanford medical interview in 2 days with 4 professors"
                }
                rows={4}
                aria-label="Describe your interview"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && canLaunch) { e.preventDefault(); handleLaunch(); } }}
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: `1px solid ${isListening ? "rgba(116,185,160,0.5)" : canLaunch ? "rgba(228,163,57,0.4)" : "var(--line)"}`,
                  borderRadius: "var(--radius)",
                  padding: "18px 64px 18px 20px",
                  fontSize: 20,
                  fontFamily: "var(--ui)",
                  fontWeight: 300,
                  color: "var(--text)",
                  outline: "none",
                  resize: "none",
                  lineHeight: 1.7,
                  transition: "border-color 0.3s",
                }}
              />

              <button
                onClick={() => isListening ? stop() : start()}
                disabled={isProcessing}
                style={{
                  position: "absolute", right: 14, bottom: 18,
                  height: 44, borderRadius: 999, padding: "0 18px",
                  border: `1px solid ${isListening ? "rgba(116,185,160,0.55)" : "var(--line)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  fontSize: 15.5, fontFamily: "var(--ui)", fontWeight: 500, cursor: "pointer",
                  background: isListening ? "var(--calm-soft)" : "var(--raised)",
                  color: isListening ? "var(--calm)" : "var(--dim)",
                  animation: isListening ? "micRing 1.2s ease-out infinite" : "none",
                  transition: "all 0.25s",
                }}
              >
                {isProcessing
                  ? <><CircleNotch size={18} weight="bold" style={{ animation: "rotateSlow 1s linear infinite" }} /> Writing it down</>
                  : isListening
                  ? <><Stop size={17} weight="fill" /> Stop listening</>
                  : <><Microphone size={18} weight="regular" /> Speak instead</>}
              </button>

              <AnimatePresence>
                {(isListening || isProcessing) && !clarifyQuestion && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{
                      position: "absolute", top: 12, right: 14,
                      display: "flex", alignItems: "center", gap: 6,
                      background: "var(--calm-soft)",
                      border: "1px solid rgba(116,185,160,0.3)",
                      borderRadius: 999, padding: "4px 10px",
                    }}
                  >
                    <span className="dot" style={{ background: "var(--calm)", width: 5, height: 5 }} />
                    <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--calm)", letterSpacing: "0.05em" }}>
                      {isListening ? "LISTENING" : "TRANSCRIBING"}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* What we understood — live transparency */}
            <AnimatePresence>
              {intentChips.length > 0 && launchPhase !== "idle" && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--dim)", letterSpacing: "0.1em" }}>
                    WE UNDERSTOOD:
                  </span>
                  {intentChips.map((c, i) => (
                    <span key={i} className="tag" style={{ color: "var(--honey)", borderColor: "rgba(228,163,57,0.3)" }}>
                      {c.label}
                    </span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Clarifying follow-up (voice) */}
            <AnimatePresence>
              {launchPhase === "clarifying" && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="card"
                  style={{ padding: "16px 18px", borderColor: "rgba(228,163,57,0.35)", display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--honey)", letterSpacing: "0.12em" }}>
                    ONE QUICK QUESTION
                  </div>
                  <div style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 19, color: "var(--text)", lineHeight: 1.65 }}>
                    {clarifyQuestion}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {isListening && (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 15, color: "var(--calm)", letterSpacing: "0.06em" }}>
                        <span className="dot" style={{ background: "var(--calm)", width: 5, height: 5 }} />
                        LISTENING. TAP THE MIC WHEN DONE.
                      </span>
                    )}
                    {isProcessing && (
                      <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--honey)", letterSpacing: "0.06em" }}>
                        TRANSCRIBING…
                      </span>
                    )}
                    <button className="btn btn-ghost" onClick={skipClarify}
                      style={{ height: 28, fontSize: 16, padding: "0 12px", marginLeft: "auto" }}>
                      Skip
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mic error */}
            <AnimatePresence>
              {micError && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    padding: "12px 16px", borderRadius: 12,
                    background: "rgba(217,139,139,0.07)",
                    border: "1px solid rgba(217,139,139,0.25)",
                    fontFamily: "var(--mono)", fontSize: 16,
                    color: "var(--alert)", lineHeight: 1.55,
                  }}
                >
                  {micError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Support level — Maras/Bath adapted-interview accommodations */}
            {!isConvo && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--dim)", letterSpacing: "0.12em" }}>
                  SUPPORT LEVEL
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SUPPORT_LEVELS.map(s => (
                    <button key={s.key} onClick={() => setSupportLevel(s.key)} aria-pressed={supportLevel === s.key}
                      style={{
                        padding: "8px 16px", borderRadius: 999, cursor: "pointer",
                        background: supportLevel === s.key ? "var(--calm-soft)" : "transparent",
                        border: `1px solid ${supportLevel === s.key ? "rgba(116,185,160,0.5)" : "var(--line)"}`,
                        fontFamily: "var(--ui)", fontSize: 18,
                        color: supportLevel === s.key ? "var(--calm)" : "var(--dim)",
                        transition: "all 0.2s",
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <span style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 18, color: "var(--dim)", lineHeight: 1.6 }}>
                  {SUPPORT_LEVELS.find(s => s.key === supportLevel)?.desc}
                </span>
              </div>
            )}

            {/* Interview tone — stored per session, clearly shown before start */}
            {!isConvo && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--dim)", letterSpacing: "0.12em" }}>
                  INTERVIEWER TONE
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {TONES.map(t => (
                    <button key={t.key} onClick={() => setTone(t.key)} aria-pressed={tone === t.key}
                      style={{
                        padding: "8px 16px", borderRadius: 999, cursor: "pointer",
                        background: tone === t.key ? "var(--honey-soft)" : "transparent",
                        border: `1px solid ${tone === t.key ? "rgba(228,163,57,0.45)" : "var(--line)"}`,
                        fontFamily: "var(--ui)", fontSize: 18,
                        color: tone === t.key ? "var(--honey)" : "var(--dim)",
                        transition: "all 0.2s",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <span style={{ fontFamily: "var(--ui)", fontWeight: 300, fontSize: 18, color: "var(--dim)", lineHeight: 1.6 }}>
                  You selected: <strong style={{ fontWeight: 500, color: "var(--text-2)" }}>{TONES.find(t => t.key === tone)?.label}</strong>. {TONES.find(t => t.key === tone)?.desc}
                </span>
              </div>
            )}

            {/* Options */}
            {!isConvo && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => setShowContext(v => !v)}
                aria-expanded={showContext}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "var(--mono)", fontSize: 16,
                  color: showContext ? "var(--honey)" : "var(--dim)",
                  letterSpacing: "0.08em",
                  transition: "color 0.2s", padding: "4px 0",
                }}
              >
                <span aria-hidden>{showContext ? "−" : "+"}</span> ADD BACKGROUND
              </button>
              <button
                onClick={() => setTimedMode(v => !v)}
                aria-pressed={timedMode}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                  background: timedMode ? "var(--honey-soft)" : "transparent",
                  border: `1px solid ${timedMode ? "rgba(228,163,57,0.45)" : "var(--line)"}`,
                  fontFamily: "var(--mono)", fontSize: 15,
                  color: timedMode ? "var(--honey)" : "var(--dim)",
                  letterSpacing: "0.08em",
                  transition: "all 0.22s",
                }}
              >
                TIMED MODE {timedMode ? "· 60s PER ANSWER" : "· OFF"}
              </button>
            </div>
            )}

            <AnimatePresence>
              {!isConvo && showContext && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <label htmlFor="background-input" style={{
                    display: "block", fontFamily: "var(--mono)", fontSize: 14,
                    color: "var(--dim)", letterSpacing: "0.12em", margin: "10px 0 8px",
                  }}>
                    YOUR BACKGROUND (OPTIONAL)
                  </label>
                  <textarea
                    id="background-input"
                    value={resumeContext}
                    onChange={e => setResumeContext(e.target.value)}
                    placeholder={"Paste your résumé or any background that helps the panel ask questions about you specifically."}
                    rows={4}
                    style={{
                      width: "100%",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius)",
                      padding: "16px 18px",
                      fontSize: 18,
                      fontFamily: "var(--ui)",
                      fontWeight: 300,
                      color: "var(--text-2)",
                      outline: "none",
                      resize: "none",
                      lineHeight: 1.7,
                      display: "block",
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Launch */}
            <motion.button
              whileHover={canLaunch ? { y: -2 } : {}}
              whileTap={canLaunch ? { scale: 0.99 } : {}}
              className={`btn ${canLaunch ? "btn-primary" : "btn-ghost"}`}
              onClick={handleLaunch}
              disabled={!canLaunch && launchPhase === "idle"}
              style={{ width: "100%", maxWidth: 400, height: 52, fontSize: 20 }}
            >
              {canLaunch ? (isConvo ? "Start the conversation" : "Build my panel")
                : launchPhase === "parsing" ? "Understanding your request…"
                : launchPhase === "clarifying" ? "Waiting for your answer…"
                : launchPhase === "launching" ? "Launching…"
                : isConvo ? "Say what you'd like to chat about" : "Describe your interview to begin"}
            </motion.button>

            {/* Examples */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--dim)", letterSpacing: "0.14em", opacity: 0.7 }}>
                EXAMPLES
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {examples.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setSituation(ex.label)}
                    style={{
                      background: i === exIdx ? "var(--honey-soft)" : "transparent",
                      border: `1px solid ${i === exIdx ? "rgba(228,163,57,0.35)" : "var(--line)"}`,
                      borderRadius: 999, cursor: "pointer",
                      padding: "6px 14px",
                      fontFamily: "var(--mono)", fontSize: 15,
                      color: i === exIdx ? "var(--honey)" : "var(--dim)",
                      letterSpacing: "0.05em",
                      transition: "all 0.35s ease",
                    }}
                  >
                    {ex.tag}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSituation(examples[exIdx].label)}
                style={{
                  background: "none", border: "none", cursor: "pointer", textAlign: "left",
                  fontFamily: "var(--ui)", fontWeight: 300,
                  fontSize: 18, color: "var(--dim)", lineHeight: 1.6, padding: 0, opacity: 0.75,
                }}
              >
                "{examples[exIdx].label}"
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
