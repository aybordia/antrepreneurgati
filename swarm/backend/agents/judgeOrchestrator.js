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

  const { personas = [], sessionPlan, situation = "", mode = "interview", tone = "neutral" } = parsed;
  if (!personas.length) {
    return safeReturn(null, "Walk me through your situation in your own words.", "Recovery");
  }

  // ── Conversation mode: casual, follow-the-user's-lead, non-evaluative ──────
  if (mode === "conversation") {
    return runConversationTurn({ transcript, personas, situation, history });
  }

  const TONE_LINES = {
    supportive: "Your tone: warm and encouraging. Acknowledge what they said kindly before your question.",
    neutral: "Your tone: professional and even.",
    challenging: "Your tone: direct and brisk. Terse follow-ups, no small talk, push for specifics, politely push back on vague answers. Firm but never mocking.",
  };
  const toneLine = TONE_LINES[tone] || TONE_LINES.neutral;

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
${toneLine}
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
${toneLine}
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

// ── Conversation mode ─────────────────────────────────────────────────────────
// Casual practice: one friendly fictional persona, follows the user's lead,
// never evaluates. Same conduct rules — literal language, no comments on
// pauses or delivery. No planned questions, no session-complete gate.
async function runConversationTurn({ transcript, personas, situation, history }) {
  const p = personas[0];

  const CONVO_RULES = `Conversation rules (always apply):
- This is relaxed, casual conversation practice. You are NOT an interviewer and you NEVER evaluate, grade, or coach.
- Follow the user's lead: respond genuinely to what they said, share a brief thought or reaction of your own, and keep the conversation going naturally.
- Ask at most ONE gentle, open question per turn, and it's fine to sometimes just respond without a question.
- Clear, literal, friendly language. No idioms that could confuse, no sarcasm.
- NEVER comment on their pauses, pacing, speech patterns, or how they talk. Long pauses are fine — never reference them.
- 1-3 short sentences.`;

  // Opening
  if (!transcript && history.length === 0) {
    try {
      const raw = await callLLM({
        systemPrompt: `You are ${p.name} (a fictional conversation-practice partner). Style: ${p.style}
The user wants casual conversation practice. Their words: "${clip(situation, 120)}"
${CONVO_RULES}
Say a friendly hello, mention your first name, and open the conversation gently around what they said they'd like to talk about.
Return ONLY: {"line":"..."}`,
        userPrompt: situation,
        maxTokens: 100,
      });
      const result = parseJSON(raw);
      if (result?.line) return safeReturn(p, result.line, "Conversation opening", { userPerformanceNote: "Conversation started" });
    } catch (err) {
      console.error("[judge] conversation opening error:", err.message);
    }
    return safeReturn(p, `Hi, I'm ${p.name.split(/\s+/)[0]}. Nice to meet you. What would you like to chat about today?`, "Conversation opening fallback", { userPerformanceNote: "Conversation started" });
  }

  const recentHistory = history.slice(-6).map(t => `${t.speaker}: ${t.text}`).join("\n");
  try {
    const raw = await callLLM({
      systemPrompt: `You are ${p.name} (a fictional conversation-practice partner). Style: ${p.style}
${CONVO_RULES}
Return ONLY: {"line":"..."}`,
      userPrompt: `${recentHistory}\nUser: "${transcript}"`,
      maxTokens: 110,
    });
    const result = parseJSON(raw);
    if (result?.line) return safeReturn(p, result.line, "Conversation");
  } catch (err) {
    console.error("[judge] conversation error:", err.message);
  }
  return safeReturn(p, "That sounds interesting. Tell me more about it?", "Conversation fallback");
}
