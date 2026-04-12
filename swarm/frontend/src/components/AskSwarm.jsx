import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { streamFetch } from "../lib/api";
import { speakText } from "../hooks/useVoiceOutput";
import { useElevenLabsSTT } from "../hooks/useElevenLabsSTT";

const SUGGESTIONS = [
  "What was my weakest answer and why?",
  "How did I handle pushback?",
  "What should I say differently next time?",
  "Where did I lose confidence?",
  "What were my filler phrases?",
];

const sv = {
  initial: { opacity: 0, filter: "blur(10px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, filter: "blur(8px)", transition: { duration: 0.35 } },
};

export default function AskSwarm({ sessionResult, situation, debrief, onRunAgain, getIdToken }) {
  const [mode, setMode] = useState(null); // null = picker, "text", "voice"
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const bottomRef = useRef(null);
  const chatHistoryRef = useRef([]);
  const currentAudioRef = useRef(null);
  const sessionEndedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Stop audio when component unmounts
  useEffect(() => {
    return () => {
      sessionEndedRef.current = true;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const askQuestion = useCallback(async (question) => {
    if (!question.trim() || isStreaming || isAISpeaking) return;

    const userMsg = { role: "user", content: question };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    const assistantIdx = newMessages.length;
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    let fullAnswer = "";
    try {
      const token = await getIdToken();

      await streamFetch("/api/ask-swarm", {
        question,
        interviewTranscript: sessionResult?.history || [],
        situation,
        debrief,
        sessionData: sessionResult?.sessionData || {},
        chatHistory: chatHistoryRef.current,
      }, chunk => {
        if (chunk.error) {
          setMessages(prev => {
            const u = [...prev];
            u[assistantIdx] = { role: "assistant", content: `Error: ${chunk.error}` };
            return u;
          });
          return;
        }
        if (chunk.chunk) {
          fullAnswer += chunk.chunk;
          setMessages(prev => {
            const u = [...prev];
            u[assistantIdx] = { role: "assistant", content: fullAnswer };
            return u;
          });
        }
        if (chunk.done) {
          chatHistoryRef.current = [
            ...chatHistoryRef.current,
            { role: "user", content: question },
            { role: "assistant", content: fullAnswer },
          ];
        }
      }, token);
    } catch (e) {
      console.error("[AskSwarm] error:", e);
      setMessages(prev => {
        const u = [...prev];
        u[assistantIdx] = { role: "assistant", content: `Error: ${e.message}` };
        return u;
      });
      setIsStreaming(false);
      return;
    }

    setIsStreaming(false);

    // In voice mode, speak the answer then auto-restart mic
    if (mode === "voice" && fullAnswer && !sessionEndedRef.current) {
      setIsAISpeaking(true);
      try {
        const audio = await speakText({ text: fullAnswer });
        if (audio) {
          currentAudioRef.current = audio;
          await new Promise(res => { audio.onended = res; audio.onerror = res; audio.play().catch(res); });
          currentAudioRef.current = null;
        }
      } catch {}
      setIsAISpeaking(false);
      if (!sessionEndedRef.current) {
        setTimeout(() => start(), 300);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isStreaming, isAISpeaking, sessionResult, situation, debrief, getIdToken, mode]);

  const { start, stop, isListening, isProcessing, micError } = useElevenLabsSTT({
    onResult: async (text) => {
      if (!text?.trim() || isStreaming || isAISpeaking) return;
      await askQuestion(text);
    },
    silenceThresholdMs: 2500,
  });

  // Auto-start mic when entering voice mode
  useEffect(() => {
    if (mode === "voice") {
      setTimeout(() => start(), 500);
    }
    if (mode !== "voice") {
      stop();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    askQuestion(input);
  };

  // ── Mode picker ──────────────────────────────────────────────────────────
  if (mode === null) {
    return (
      <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
        style={{ background: "#070709", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
      >
        <div className="ambient" />
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column", alignItems: "center", gap: "32px",
          maxWidth: "420px", width: "100%", padding: "0 24px", textAlign: "center",
        }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: "0.18em", marginBottom: "10px" }}>PHASE 4 OF 4</div>
            <div style={{ fontFamily: "var(--display)", fontSize: "32px", fontWeight: 400, marginBottom: "10px" }}>Ask Swarm AI</div>
            <div style={{ fontFamily: "var(--ui)", fontSize: "14px", color: "var(--muted)", lineHeight: 1.65 }}>
              Your full interview is loaded. Ask anything — how you did, what to fix, what to say next time.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setMode("voice")}
              style={{
                padding: "20px 24px", borderRadius: "16px",
                background: "rgba(123,108,255,0.1)",
                border: "1px solid rgba(123,108,255,0.35)",
                cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: "16px",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(123,108,255,0.18)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(123,108,255,0.1)"}
            >
              <span style={{ fontSize: "28px" }}>🎤</span>
              <div>
                <div style={{ fontFamily: "var(--display)", fontSize: "16px", color: "var(--text)", marginBottom: "4px" }}>Voice</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)" }}>Speak your questions — Swarm AI talks back</div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setMode("text")}
              style={{
                padding: "20px 24px", borderRadius: "16px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: "16px",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
            >
              <span style={{ fontSize: "28px" }}>⌨️</span>
              <div>
                <div style={{ fontFamily: "var(--display)", fontSize: "16px", color: "var(--text)", marginBottom: "4px" }}>Text</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)" }}>Type your questions, read the answers</div>
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Chat UI ──────────────────────────────────────────────────────────────
  return (
    <motion.div className="screen" variants={sv} initial="initial" animate="animate" exit="exit"
      style={{ background: "#070709", display: "flex", flexDirection: "column" }}
    >
      <div className="ambient" />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(123,108,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(123,108,255,0.025) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
      }} />

      {/* Header */}
      <div style={{
        position: "relative", zIndex: 2, flexShrink: 0,
        padding: "28px 28px 0",
        maxWidth: "720px", margin: "0 auto", width: "100%",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: "0.18em", marginBottom: "6px" }}>PHASE 4 OF 4</div>
          <div style={{ fontFamily: "var(--display)", fontSize: "26px", fontWeight: 400 }}>Ask Swarm AI</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
            <span style={{
              fontFamily: "var(--mono)", fontSize: "10px", letterSpacing: "0.08em",
              color: mode === "voice" ? "var(--primary)" : "var(--muted)",
              background: mode === "voice" ? "rgba(123,108,255,0.12)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${mode === "voice" ? "rgba(123,108,255,0.3)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "999px", padding: "3px 10px",
            }}>
              {mode === "voice" ? "🎤 Voice" : "⌨️ Text"}
            </span>
            <button
              onClick={() => { stop(); setMode(null); }}
              style={{
                fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)",
                background: "none", border: "none", cursor: "pointer", padding: "3px 6px",
                textDecoration: "underline", textUnderlineOffset: "2px",
              }}
            >
              switch
            </button>
          </div>
        </div>
        <button
          onClick={onRunAgain}
          style={{
            padding: "8px 16px", borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.09)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--muted)", cursor: "pointer",
            fontFamily: "var(--mono)", fontSize: "11px",
            flexShrink: 0, marginTop: "4px",
            transition: "all 0.18s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "var(--muted)"; }}
        >
          Run Again →
        </button>
      </div>

      {/* Chat messages */}
      <div style={{
        position: "relative", zIndex: 2,
        flex: 1, overflowY: "auto",
        padding: "20px 28px",
        maxWidth: "720px", margin: "0 auto", width: "100%",
        display: "flex", flexDirection: "column", gap: "14px",
        scrollbarWidth: "none",
      }}>
        {messages.length === 0 && mode === "text" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}
          >
            <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "rgba(139,138,155,0.45)", letterSpacing: "0.1em" }}>SUGGESTED</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {SUGGESTIONS.map((s, i) => (
                <motion.button key={i}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  onClick={() => askQuestion(s)}
                  disabled={isStreaming}
                  style={{
                    background: "rgba(123,108,255,0.07)", border: "1px solid rgba(123,108,255,0.18)",
                    borderRadius: "8px", padding: "8px 14px", cursor: "pointer",
                    fontFamily: "var(--mono)", fontSize: "11px", color: "var(--primary)",
                    letterSpacing: "0.03em", transition: "all 0.18s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(123,108,255,0.14)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(123,108,255,0.07)"}
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
              style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}
            >
              <div style={{
                maxWidth: "88%",
                padding: msg.role === "user" ? "11px 16px" : "16px 20px",
                borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
                background: msg.role === "user" ? "rgba(123,108,255,0.14)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${msg.role === "user" ? "rgba(123,108,255,0.28)" : "rgba(255,255,255,0.07)"}`,
                fontFamily: msg.role === "user" ? "var(--mono)" : "var(--ui)",
                fontSize: msg.role === "user" ? "13px" : "14px",
                color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap",
              }}>
                {msg.content}
                {isStreaming && i === messages.length - 1 && msg.role === "assistant" && (
                  <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>|</motion.span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Voice mode status bar */}
      {mode === "voice" && (
        <div style={{
          position: "relative", zIndex: 2, flexShrink: 0,
          padding: "0 28px 28px",
          maxWidth: "720px", margin: "0 auto", width: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
        }}>
          {micError && (
            <div style={{
              width: "100%", padding: "10px 14px", borderRadius: "10px",
              background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)",
              fontFamily: "var(--mono)", fontSize: "11px", color: "var(--coral)",
            }}>
              {micError}
            </div>
          )}

          <AnimatePresence mode="wait">
            {isAISpeaking ? (
              <motion.div key="speaking"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "rgba(123,108,255,0.1)", border: "1px solid rgba(123,108,255,0.25)",
                  borderRadius: "999px", padding: "12px 24px", backdropFilter: "blur(12px)",
                }}
              >
                <span className="dot" style={{ background: "var(--primary)", width: "6px", height: "6px" }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--primary)", letterSpacing: "0.06em" }}>
                  Swarm AI speaking…
                </span>
              </motion.div>
            ) : isStreaming ? (
              <motion.div key="thinking"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "rgba(200,240,100,0.08)", border: "1px solid rgba(200,240,100,0.2)",
                  borderRadius: "999px", padding: "12px 24px", backdropFilter: "blur(12px)",
                }}
              >
                <span className="dot" style={{ background: "var(--success)", width: "6px", height: "6px" }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--success)", letterSpacing: "0.06em" }}>
                  Thinking…
                </span>
              </motion.div>
            ) : isProcessing ? (
              <motion.div key="processing"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)",
                  borderRadius: "999px", padding: "12px 24px", backdropFilter: "blur(12px)",
                }}
              >
                <span className="dot" style={{ background: "var(--amber)", width: "6px", height: "6px" }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--amber)", letterSpacing: "0.06em" }}>
                  Transcribing…
                </span>
              </motion.div>
            ) : (
              <motion.button key="listening"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => isListening ? stop() : start()}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: isListening ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isListening ? "rgba(245,166,35,0.35)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "999px", padding: "12px 24px", backdropFilter: "blur(12px)",
                  cursor: "pointer",
                  animation: isListening ? "micRing 1.1s ease-out infinite" : "none",
                }}
              >
                <span style={{ fontSize: "15px" }}>{isListening ? "⏹" : "🎤"}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: isListening ? "var(--amber)" : "var(--muted)", letterSpacing: "0.06em" }}>
                  {isListening ? "Listening — tap to send" : "Tap to speak"}
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Text mode input */}
      {mode === "text" && (
        <div style={{
          position: "relative", zIndex: 2, flexShrink: 0,
          padding: "0 28px 28px",
          maxWidth: "720px", margin: "0 auto", width: "100%",
        }}>
          <form onSubmit={handleSubmit} style={{ position: "relative" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything about your interview…"
              disabled={isStreaming}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${input.trim() ? "rgba(123,108,255,0.45)" : "rgba(255,255,255,0.09)"}`,
                borderRadius: "12px", padding: "16px 56px 16px 18px",
                fontSize: "14px", fontFamily: "var(--ui)", color: "var(--text)", outline: "none",
                boxShadow: input.trim() ? "0 0 0 3px rgba(123,108,255,0.09)" : "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
                opacity: isStreaming ? 0.5 : 1,
              }}
            />
            <button type="submit" disabled={!input.trim() || isStreaming}
              style={{
                position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                width: "36px", height: "36px", borderRadius: "8px", border: "none",
                background: input.trim() && !isStreaming ? "rgba(123,108,255,0.85)" : "rgba(255,255,255,0.05)",
                color: "white", cursor: input.trim() && !isStreaming ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", transition: "all 0.18s",
                opacity: input.trim() && !isStreaming ? 1 : 0.35,
              }}
            >↑</button>
          </form>
        </div>
      )}
    </motion.div>
  );
}
