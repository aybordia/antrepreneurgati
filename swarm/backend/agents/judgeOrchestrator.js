// PROMPT VERSION: 4.2 — fully generative, callLLMStream for reliability
import { callLLM, callLLMStream, parseJSON } from "../lib/llm.js";

// Truncate research fields so they stay compact in the prompt
const clip = (s, n = 120) => s && s.length > n ? s.slice(0, n) + "…" : (s || "");

export async function runJudgeOrchestrator({ transcript, sessionContext, history, currentQuestionIndex = 0 }) {
  const parsed = typeof sessionContext === "string" ? JSON.parse(sessionContext) : sessionContext;
  const { personas, sessionPlan, situation, researchContext } = parsed;

  const rc = researchContext || {};

  // Compact research block — only the 4 most actionable fields, clipped tight
  const researchLines = [
    rc.interviewerPatterns  && `INTERVIEWER STYLE: ${clip(rc.interviewerPatterns)}`,
    rc.psychologicalProfile && `WHAT THEY EVALUATE: ${clip(rc.psychologicalProfile)}`,
    rc.diagnosedWeakness    && `USER'S WEAK SPOT: ${clip(rc.diagnosedWeakness)}`,
    rc.keyFindings?.length  && `KEY INSIGHTS: ${rc.keyFindings.slice(0, 2).map(f => clip(f, 60)).join(" | ")}`,
  ].filter(Boolean).join("\n");

  const turnCount = history.filter(t => t.speaker && t.text).length;
  const totalTurns = (sessionPlan?.totalEstimatedMinutes || 5) * 2;

  // ── Opening turn ─────────────────────────────────────────────────────────────
  if (!transcript && history.length === 0) {
    const p = personas[0];
    try {
      const raw = await callLLM({
        systemPrompt: `You are ${p.name}, ${p.role}. ${p.style}
Situation: "${situation}"
${researchLines ? `Research:\n${researchLines}\n` : ""}
Introduce yourself briefly, then open with ONE sharp, specific question drawn from the research.
Never ask "what's at stake" or "what makes you nervous". Be concrete and domain-specific.
Return ONLY JSON: {"line": "..."}`,
        userPrompt: situation,
        maxTokens: 180,
      });
      const result = parseJSON(raw);
      if (result?.line) return { nextPersona: p.name, voiceId: p.voiceId, line: result.line, intent: "Opening", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "Session started" };
    } catch (err) {
      console.error("[judge] opening error:", err.message);
    }
    return { nextPersona: p.name, voiceId: p.voiceId, line: `Hi, I'm ${p.name} — ${p.role}. Let's get into it.`, intent: "Opening fallback", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "Session started" };
  }

  // ── Session end ───────────────────────────────────────────────────────────────
  if (turnCount >= totalTurns + 4) {
    return { nextPersona: personas[0].name, voiceId: personas[0].voiceId, line: "That covers everything I wanted to explore. Thanks for your time.", intent: "End", sessionAdvancing: false, sessionComplete: true, userPerformanceNote: "Session completed" };
  }

  // ── Pick active persona — rotate naturally across session arc ─────────────────
  const personaIndex = Math.min(Math.floor((turnCount / Math.max(totalTurns, 1)) * personas.length), personas.length - 1);
  const p = personas[personaIndex];

  // ── Detect pure greeting ──────────────────────────────────────────────────────
  const trimmed = (transcript || "").trim();
  const isGreeting = trimmed.split(/\s+/).filter(Boolean).length <= 4 &&
    /^(hi+|hello+|hey+|good\s*(morning|afternoon|evening)|howdy)\b/i.test(trimmed);

  // ── Stage hint ────────────────────────────────────────────────────────────────
  const stage = turnCount < 2
    ? "EARLY — warm intro, one opening question"
    : turnCount >= totalTurns - 2
    ? "CLOSING — synthesize, leave them thinking"
    : "MID — escalate, push back on vague answers, dig into specifics";

  // ── Recent history (last 6 turns only) ───────────────────────────────────────
  const recentHistory = history.slice(-6).map(t => `${t.speaker}: ${t.text}`).join("\n");

  // ── Single tight prompt — everything the model needs, nothing it doesn't ──────
  const systemPrompt = `You are ${p.name}, ${p.role}. ${p.style}
Situation: "${situation}"
Research (use this — don't ignore it):
${researchLines || `Practice session for: "${situation}"`}

SESSION: Turn ${turnCount + 1}/${totalTurns}. Stage: ${stage}

RULES — no exceptions:
1. React to what the user JUST said — quote or reference their exact words.
2. Then either dig deeper, push back on something weak, or introduce a new research-grounded angle.
3. Never repeat a question already asked. Never ask generic filler ("what's at stake", "how does that make you feel").
4. Max 2 sentences. Specific to this situation only.
${isGreeting ? "5. They greeted you — introduce yourself briefly then ask your first question." : ""}

Return ONLY JSON (no markdown): {"nextPersona":"${p.name}","voiceId":"${p.voiceId}","line":"...","intent":"...","sessionAdvancing":false,"sessionComplete":false,"userPerformanceNote":"..."}`;

  const userPrompt = `Conversation:\n${recentHistory}\n\nUser just said: "${transcript}"`;

  try {
    const raw = await callLLM({ systemPrompt, userPrompt, maxTokens: 250 });
    const result = parseJSON(raw);
    if (result?.line) {
      const sentences = result.line.match(/[^.!?]+[.!?]+/g) || [result.line];
      result.line = sentences.slice(0, 2).join(" ").trim();
      return result;
    }
    console.error("[judge] bad parse:", raw?.slice(0, 100));
  } catch (err) {
    console.error("[judge] LLM error:", err.message);
    // Recovery: minimal call
    try {
      const recoverRaw = await callLLM({
        systemPrompt: `You are ${p.name}, ${p.role}. Session: "${situation}". React to what was said and ask one specific follow-up. 1-2 sentences. Return ONLY JSON: {"line":"..."}`,
        userPrompt: `They said: "${transcript}". Recent: ${recentHistory.slice(-200)}`,
        maxTokens: 100,
      });
      const r = parseJSON(recoverRaw);
      if (r?.line) return { nextPersona: p.name, voiceId: p.voiceId, line: r.line, intent: "Recovery", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "Recovery" };
    } catch {}
  }

  // Last resort — echo their words
  const words = trimmed.split(/\s+/).slice(0, 5).join(" ");
  return {
    nextPersona: p.name, voiceId: p.voiceId,
    line: words ? `You mentioned "${words}" — say more about that.` : "Tell me more.",
    intent: "Last resort", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "LLM unavailable",
  };
}
