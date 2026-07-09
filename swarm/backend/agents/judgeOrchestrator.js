// PROMPT VERSION: 5.0 — walks the composed question plan with assigned personas.
// Accessibility constraints: one clear literal question at a time; never comments
// on the candidate's pauses, pacing, speech patterns, or body language.
import { callLLM, parseJSON } from "../lib/llm.js";

const clip = (s, n = 80) => s && s.length > n ? s.slice(0, n) + "…" : (s || "");

const CONDUCT_RULES = `Conduct rules (always apply):
- Ask ONE question at a time. Clear, literal, direct wording — no idioms, no trick phrasing, no multi-part questions.
- NEVER comment on the candidate's pauses, thinking time, pacing, tone of voice, eye contact, or body language. Long pauses are normal — never reference them.
- React genuinely to the CONTENT of what they said. Brief acknowledgment, then your question.
- 1-2 sentences max. No filler.`;

function safeReturn(p, line, intent, extras = {}) {
  return {
    nextPersona: p?.name || "Interviewer",
    voiceId: p?.voiceId || null,
    voiceSettings: p?.voiceSettings || null,
    line,
    intent,
    sessionAdvancing: false,
    sessionComplete: false,
    userPerformanceNote: "",
    ...extras,
  };
}

export async function runJudgeOrchestrator({ transcript, sessionContext, history, currentQuestionIndex = 0 }) {
  let parsed;
  try {
    parsed = typeof sessionContext === "string" ? JSON.parse(sessionContext) : sessionContext;
  } catch (e) {
    console.error("[judge] bad sessionContext:", e.message);
    return safeReturn(null, "Let's continue. Tell me more about your situation.", "Recovery");
  }

  const { personas = [], sessionPlan, situation = "" } = parsed;
  if (!personas.length) {
    return safeReturn(null, "Walk me through your situation in your own words.", "Recovery");
  }

  const questions = sessionPlan?.questions || [];
  const userTurns = history.filter(t => t.speaker === "You" || t.speaker === "User").length;

  // Each planned question gets an ask + one follow-up before advancing
  const TURNS_PER_QUESTION = 2;
  const qIndex = Math.min(Math.floor(userTurns / TURNS_PER_QUESTION), Math.max(questions.length - 1, 0));
  const question = questions[qIndex] || null;
  const isFollowUp = userTurns % TURNS_PER_QUESTION !== 0 || !question;
  const advancing = !isFollowUp && userTurns > 0; // this turn opens a new planned question

  // Persona: whoever the current question is assigned to
  const p = personas.find(x => x.name === question?.assignedPersona)
    || personas[qIndex % personas.length];

  // ── Opening turn ────────────────────────────────────────────────────────────
  if (!transcript && history.length === 0) {
    const firstQ = questions[0];
    try {
      const raw = await callLLM({
        systemPrompt: `You are ${p.name}, ${p.role} (a fictional simulated interviewer). Style: ${p.style}
Situation: "${clip(situation, 120)}"
${CONDUCT_RULES}
Introduce yourself briefly (name + role), then ask this planned opening question in your own natural words: "${firstQ?.text || "What brought you here today?"}"
Return ONLY: {"line":"..."}`,
        userPrompt: situation,
        maxTokens: 120,
      });
      const result = parseJSON(raw);
      if (result?.line) return safeReturn(p, result.line, "Opening", { userPerformanceNote: "Session started" });
    } catch (err) {
      console.error("[judge] opening error:", err.message);
    }
    return safeReturn(p, `Hi, I'm ${p.name} — ${p.role}. ${firstQ?.text || "To start: what are you preparing for?"}`, "Opening fallback", { userPerformanceNote: "Session started" });
  }

  // ── Session end: all planned questions covered ──────────────────────────────
  if (questions.length && userTurns >= questions.length * TURNS_PER_QUESTION) {
    return safeReturn(p, "That covers everything we planned to explore. Thank you — you'll get your full debrief now.", "End", { sessionComplete: true, userPerformanceNote: "Session completed" });
  }

  const trimmed = (transcript || "").trim();
  const recentHistory = history.slice(-4).map(t => `${t.speaker}: ${t.text}`).join("\n");

  const task = isFollowUp
    ? `Ask ONE brief follow-up about something specific they just said. Stay on the current topic: "${clip(question?.text, 100)}"`
    : `Transition naturally, then ask this planned question in your own words: "${question?.text}"${question?.type === "technical" ? " (domain question — keep it concrete and approachable)" : ""}`;

  const systemPrompt = `You are ${p.name}, ${p.role} (a fictional simulated interviewer). Style: ${p.style}
Situation: "${clip(situation, 120)}"
${CONDUCT_RULES}
Task: ${task}
Return ONLY: {"line":"...","intent":"..."}`;

  try {
    const raw = await callLLM({ systemPrompt, userPrompt: `${recentHistory}\nUser: "${transcript}"`, maxTokens: 120 });
    const result = parseJSON(raw);
    if (result?.line) {
      const sentences = result.line.match(/[^.!?]+[.!?]+/g) || [result.line];
      const line = sentences.slice(0, 3).join(" ").trim();
      return safeReturn(p, line, result.intent || (isFollowUp ? "Follow-up" : "Planned question"), { sessionAdvancing: advancing });
    }
  } catch (err) {
    console.error("[judge] LLM error:", err.message);
  }

  // Fallback: ask the planned question verbatim — always coherent
  if (!isFollowUp && question?.text) {
    return safeReturn(p, question.text, "Planned question (fallback)", { sessionAdvancing: advancing });
  }
  const words = trimmed.split(/\s+/).slice(0, 5).join(" ");
  return safeReturn(p, words ? `You mentioned "${words}" — can you say more about that?` : "Can you tell me more?", "Last resort");
}
