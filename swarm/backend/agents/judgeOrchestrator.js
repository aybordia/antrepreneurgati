// PROMPT VERSION: 4.4 — guarded parsing, persona bounds, fast tokens
import { callLLM, parseJSON } from "../lib/llm.js";

const clip = (s, n = 80) => s && s.length > n ? s.slice(0, n) + "…" : (s || "");

export async function runJudgeOrchestrator({ transcript, sessionContext, history, currentQuestionIndex = 0 }) {
  // Guard: safe parse regardless of whether sessionContext is string or object
  let parsed;
  try {
    parsed = typeof sessionContext === "string" ? JSON.parse(sessionContext) : sessionContext;
  } catch (e) {
    console.error("[judge] bad sessionContext:", e.message);
    return { nextPersona: "Interviewer", voiceId: null, line: "Let's continue. Tell me more about your situation.", intent: "Recovery", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "" };
  }

  const { personas = [], sessionPlan, situation = "", researchContext } = parsed;
  const rc = researchContext || {};

  // Guard: ensure personas array is valid
  if (!personas.length) {
    return { nextPersona: "Interviewer", voiceId: null, line: "Walk me through your situation in your own words.", intent: "Recovery", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "" };
  }

  const researchLines = [
    rc.interviewerPatterns && `STYLE: ${clip(rc.interviewerPatterns, 80)}`,
    rc.diagnosedWeakness   && `PROBE: ${clip(rc.diagnosedWeakness, 80)}`,
  ].filter(Boolean).join(" | ");

  const turnCount = history.filter(t => t.speaker && t.text).length;
  const totalTurns = (sessionPlan?.totalEstimatedMinutes || 5) * 2;

  // Safe persona index — always in bounds
  const personaIndex = Math.min(
    Math.floor((turnCount / Math.max(totalTurns, 1)) * personas.length),
    personas.length - 1
  );
  const p = personas[personaIndex];

  // ── Opening turn ────────────────────────────────────────────────────────────
  if (!transcript && history.length === 0) {
    try {
      const raw = await callLLM({
        systemPrompt: `You are ${p.name}, ${p.role}. ${p.style} Situation: "${situation}". ${researchLines}
Introduce yourself in 1 sentence, then ask ONE sharp specific question. Return ONLY: {"line":"..."}`,
        userPrompt: situation,
        maxTokens: 80,
      });
      const result = parseJSON(raw);
      if (result?.line) return { nextPersona: p.name, voiceId: p.voiceId, line: result.line, intent: "Opening", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "Session started" };
    } catch (err) {
      console.error("[judge] opening error:", err.message);
    }
    return { nextPersona: p.name, voiceId: p.voiceId, line: `Hi, I'm ${p.name} — ${p.role}. Walk me through what you're preparing for.`, intent: "Opening fallback", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "Session started" };
  }

  // ── Session end ─────────────────────────────────────────────────────────────
  if (turnCount >= totalTurns + 4) {
    return { nextPersona: p.name, voiceId: p.voiceId, line: "That covers everything I wanted to explore. Thanks for your time.", intent: "End", sessionAdvancing: false, sessionComplete: true, userPerformanceNote: "Session completed" };
  }

  const trimmed = (transcript || "").trim();
  const isGreeting = !history.length &&
    trimmed.split(/\s+/).filter(Boolean).length <= 4 &&
    /^(hi+|hello+|hey+|good\s*(morning|afternoon|evening)|howdy)\b/i.test(trimmed);

  const stage = turnCount < 2 ? "warm" : turnCount >= totalTurns - 2 ? "closing" : "mid";
  const recentHistory = history.slice(-4).map(t => `${t.speaker}: ${t.text}`).join("\n");

  const systemPrompt = `You are ${p.name}, ${p.role}. ${p.style}
Situation: "${situation}". ${researchLines ? researchLines : ""}
Turn ${turnCount + 1}/${totalTurns}. Stage: ${stage}.
Rules: React to their exact words. 1-2 sentences max. No filler. No repeated questions.${isGreeting ? " Introduce yourself then ask first question." : ""}
Return ONLY: {"line":"...","intent":"..."}`;

  const userPrompt = `${recentHistory}\nUser: "${transcript}"`;

  try {
    const raw = await callLLM({ systemPrompt, userPrompt, maxTokens: 100 });
    const result = parseJSON(raw);
    if (result?.line) {
      const sentences = result.line.match(/[^.!?]+[.!?]+/g) || [result.line];
      const line = sentences.slice(0, 2).join(" ").trim();
      return { nextPersona: p.name, voiceId: p.voiceId, line, intent: result.intent || "Follow-up", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "" };
    }
  } catch (err) {
    console.error("[judge] LLM error:", err.message);
    try {
      const recoverRaw = await callLLM({
        systemPrompt: `You are ${p.name}. React to what was said, ask one follow-up. 1 sentence. Return ONLY: {"line":"..."}`,
        userPrompt: `They said: "${trimmed}"`,
        maxTokens: 60,
      });
      const r = parseJSON(recoverRaw);
      if (r?.line) return { nextPersona: p.name, voiceId: p.voiceId, line: r.line, intent: "Recovery", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "" };
    } catch {}
  }

  const words = trimmed.split(/\s+/).slice(0, 5).join(" ");
  return {
    nextPersona: p.name, voiceId: p.voiceId,
    line: words ? `You mentioned "${words}" — say more about that.` : "Tell me more.",
    intent: "Last resort", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "",
  };
}
