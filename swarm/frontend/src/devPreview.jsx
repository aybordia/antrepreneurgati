// Dev-only preview harness: renders screens with mock data, no auth/backend.
// Open /preview.html?screen=input|intro|debrief
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import SituationInput from "./components/SituationInput";
import VoiceSession from "./components/VoiceSession";
import Debrief from "./components/Debrief";
import PanelRail, { QuestionRail } from "./components/PanelRail";

const MOCK_PERSONAS = [
  { name: "Dr. Kalinda Naidoo", role: "Associate Professor of Cardiology", style: "Fast-paced and probing; follows the thread of what you actually said.", color: "#E4A339", question_focus: "behavioral", voiceId: "x" },
  { name: "Zhiqiang Xue", role: "Clinical Professor of Emergency Medicine", style: "Warm bedside manner; guides you through clinical scenarios step by step.", color: "#74B9A0", question_focus: "technical", voiceId: "x" },
  { name: "Amala Chandrasekar", role: "Senior Medical Student", style: "Peer-to-peer and candid; asks what actually drives you.", color: "#8FB6E8", question_focus: "motivational", voiceId: "x" },
  { name: "Rakesh Patel", role: "Professor and Chair, Behavioral Sciences", style: "Reflective and open-ended; invites you to think out loud.", color: "#D98B8B", question_focus: "mixed", voiceId: "x" },
];

const MOCK_SESSION = {
  situation: "Stanford medical interview in 2 days with 4 professors",
  personas: MOCK_PERSONAS,
  sessionPlan: { questions: [{ text: "q1" }, { text: "q2" }, { text: "q3" }, { text: "q4" }, { text: "q5" }] },
};

const MOCK_HISTORY = [
  { speaker: "Dr. Kalinda Naidoo", text: "What experiences shaped how you think about medicine?", timestamp: Date.now() - 60000 },
  { speaker: "You", text: "I volunteered at a free clinic for two years and saw how much trust matters. One patient taught me that listening is half the treatment.", timestamp: Date.now() - 50000 },
  { speaker: "Amala Chandrasekar", text: "Why Stanford in particular?", timestamp: Date.now() - 30000 },
  { speaker: "You", text: "The scholarly concentration program. I want to keep doing immunology research while training clinically.", timestamp: Date.now() - 20000 },
];

const MOCK_DEBRIEF = {
  transcript: MOCK_HISTORY.map(t => `${t.speaker}: ${t.text}`).join("\n"),
  persona_impressions: [
    { persona: "Dr. Kalinda Naidoo", impression: "Your free-clinic example was the strongest moment of the session. The detail about listening being half the treatment made your motivation concrete rather than abstract. If you bring one more specific patient story next time, that theme will carry even further." },
    { persona: "Amala Chandrasekar", impression: "I liked that you named the scholarly concentration program specifically. You clearly know why this school. Consider adding what you would research first; it makes the answer feel like a plan rather than a wish." },
  ],
  signal_summary: {
    posture: "Your sitting position shifted more during the middle of the session, and was steadiest in the first part.",
    head_tilt: "Your head angle varied at a fairly even level throughout the session.",
  },
  user_selected_categories: [],
  session_facts: { questions_asked: 2, answers_given: 2, personas: MOCK_PERSONAS.map(p => ({ name: p.name, role: p.role, color: p.color })) },
};

// Stub the debrief API so the screen renders without a backend
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  if (typeof url === "string" && url.includes("/api/debrief")) {
    return new Response(JSON.stringify(MOCK_DEBRIEF), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (typeof url === "string" && url.includes("/api/parse-intent")) {
    return new Response(JSON.stringify({ intent: { institution: "Stanford", program_type: "medical", timeframe_days: 2, num_interviewers: 4, domain: "medical", clarifying_question: null } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(url, opts);
};

const screen = new URLSearchParams(location.search).get("screen") || "input";
const noop = async () => "dev-token";

// Static mock of the active-session composition for visual review
function LiveMock() {
  const active = MOCK_PERSONAS[1];
  return (
    <div className="screen" style={{ background: "var(--ink)" }}>
      <div className="noise" />
      <div style={{
        position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", padding: "28px 20px 108px", maxWidth: 680, margin: "0 auto", gap: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)", letterSpacing: "0.16em" }}>LIVE SESSION</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--calm)", letterSpacing: "0.08em", opacity: 0.7 }}>
            CAMERA ON · PRIVATE · NO LIVE FEEDBACK
          </span>
        </div>
        <PanelRail personas={MOCK_PERSONAS} activeName={active.name} speaking={true} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 19, marginBottom: 2 }}>{active.name}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: active.color, letterSpacing: "0.05em" }}>{active.role}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--dim)", marginTop: 5, opacity: 0.7 }}>
            Simulated interviewer. Fictional, not a real person.
          </div>
        </div>
        <QuestionRail total={5} current={2} />
        <div style={{
          padding: "16px 20px", width: "100%", fontSize: 15.5, lineHeight: 1.75,
          fontFamily: "var(--ui)", fontWeight: 300,
          background: "var(--surface)", border: "1px solid var(--line)",
          borderLeft: `3px solid ${active.color}`, borderRadius: "var(--radius)",
        }}>
          You mentioned volunteering at a free clinic. Can you walk me through one moment there that changed how you think about patient care?
        </div>
        <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", gap: 14, paddingTop: 6 }}>
          {MOCK_HISTORY.map((turn, i) => {
            const p = MOCK_PERSONAS.find(x => x.name === turn.speaker);
            const isUser = turn.speaker === "You";
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", color: isUser ? "var(--calm)" : (p?.color || "var(--honey)") }}>
                  {turn.speaker.toUpperCase()}
                </span>
                <span style={{ fontSize: 14, fontFamily: "var(--ui)", fontWeight: 300, lineHeight: 1.65, opacity: i === MOCK_HISTORY.length - 1 ? 1 : 0.5 }}>
                  {turn.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)", zIndex: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--honey-soft)", border: "1px solid rgba(228,163,57,0.3)",
          borderRadius: 999, padding: "10px 20px",
        }}>
          <span className="dot" style={{ background: "var(--honey)", width: 5, height: 5 }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--honey)", letterSpacing: "0.07em" }}>
            ZHIQIANG IS SPEAKING
          </span>
        </div>
      </div>
    </div>
  );
}

function Preview() {
  if (screen === "live") return <LiveMock />;
  if (screen === "intro") {
    return <VoiceSession sessionData={MOCK_SESSION} situation={MOCK_SESSION.situation} onEndSession={() => {}} getIdToken={noop} />;
  }
  if (screen === "debrief") {
    return <Debrief sessionResult={{ history: MOCK_HISTORY, sessionData: MOCK_SESSION, signalData: [{ t: 1 }] }} situation={MOCK_SESSION.situation} onRunAgain={() => {}} onAskSwarm={() => {}} getIdToken={noop} />;
  }
  return <SituationInput onLaunch={() => {}} onBack={() => {}} getIdToken={noop} />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "var(--ink)" }}>
      <Preview />
    </div>
  </StrictMode>
);
