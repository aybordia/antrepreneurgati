// PROMPT VERSION: 3.0 — truly conversational, reactive-first
import { callLLM, callLLMStream, parseJSON } from "../lib/llm.js";

export async function runJudgeOrchestrator({ transcript, sessionContext, history, currentQuestionIndex = 0 }) {
  const parsed = typeof sessionContext === "string" ? JSON.parse(sessionContext) : sessionContext;
  const { personas, sessionPlan, situation, _isFallback } = parsed;

  // ── Opening turn ────────────────────────────────────────────────────────────
  if (!transcript && history.length === 0) {
    const firstTopic = sessionPlan.questions[0];
    const p = personas.find(x => x.name === firstTopic?.assignedPersona) || personas[0];

    try {
      const raw = await callLLM({
        systemPrompt: `You are ${p.name}, ${p.role}. Your style: ${p.style}
You are opening a practice session for someone preparing for: "${situation}"
Write your opening line — introduce yourself naturally and ease into the first topic below.
2-3 sentences max. Sound like a real ${p.role}, not a generic chatbot.
Return ONLY valid JSON: {"line": "your opening line"}`,
        userPrompt: `First topic to ease into: "${firstTopic?.text || "tell me about yourself"}"`,
        maxTokens: 150,
      });
      const result = parseJSON(raw);
      if (result?.line) {
        return { nextPersona: p.name, voiceId: p.voiceId, line: result.line, intent: "Opening", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "Session started" };
      }
    } catch (err) {
      console.error("[judge] opening error:", err.message);
    }

    // Fallback opening
    return {
      nextPersona: p.name, voiceId: p.voiceId,
      line: `Hi, I'm ${p.name} — ${p.role}. ${firstTopic?.text || "Let's get started."}`,
      intent: "Opening fallback", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "Session started",
    };
  }

  // ── Hard session limit ───────────────────────────────────────────────────────
  if (currentQuestionIndex >= sessionPlan.questions.length + 3) {
    return {
      nextPersona: personas[0].name, voiceId: personas[0].voiceId,
      line: "That covers everything I wanted to explore. Thanks for your time today.",
      intent: "Force end", sessionAdvancing: false, sessionComplete: true,
      userPerformanceNote: "Session force-ended",
    };
  }

  // ── Build the system prompt: who IS this persona for THIS situation ──────────
  const currentTopic = sessionPlan.questions[currentQuestionIndex];
  const nextTopic    = sessionPlan.questions[currentQuestionIndex + 1];
  const assignedP    = personas.find(p => p.name === currentTopic?.assignedPersona) || personas[0];

  // Detect greeting so we don't skip social norms
  const isGreeting = /^(hi+|hello+|hey+|good\s*(morning|afternoon|evening)|howdy)\b/i.test((transcript || "").trim());

  const systemPrompt = `You are ${assignedP.name}, ${assignedP.role}.
Your style: ${assignedP.style}
You are conducting a live practice session for: "${situation}"

HOW YOU RESPOND — follow this exactly:
1. REACT first (1 sentence): Acknowledge something SPECIFIC from what they just said.
   - Strong answer → "Good — you mentioned X, that's exactly the level of detail I'm looking for."
   - Vague/generic → "You kept that pretty high-level. I want to push on that."
   - Stumbled → "I noticed some hesitation there — let's try a different angle."
   - Greeting → "Hey, good to meet you. I'm ${assignedP.name}. [then ease in]"
   Never skip this step. Never react with "Great question!"

2. THEN move forward (1-2 sentences): Based on what they said, either:
   - Dig into something they specifically mentioned
   - Push back on something that was vague or weak
   - Transition naturally to a new topic

3. STAY SPECIFIC TO: "${situation}"
   Every word you say must make sense for THIS situation. Generic responses are failure.

Output ONLY valid JSON (no preamble, no markdown):
{
  "nextPersona": "${assignedP.name}",
  "voiceId": "${assignedP.voiceId}",
  "line": "your full response — react + move forward. Max 3 sentences.",
  "intent": "what this turn accomplishes",
  "sessionAdvancing": true or false,
  "sessionComplete": true or false,
  "userPerformanceNote": "brief honest note on how they did"
}

sessionAdvancing: true = move to the next topic after this turn
sessionAdvancing: false = stay on current topic (they need to go deeper or you're pushing back)
sessionComplete: true ONLY when all planned topics are done`;

  const recentHistory = history.slice(-8).map(t => `${t.speaker}: ${t.text}`).join("\n");

  const userPrompt = `CONVERSATION SO FAR:
${recentHistory}

USER JUST SAID: "${transcript}"
${isGreeting ? "⚠️ They are greeting you. Respond warmly and introduce yourself before anything else." : ""}

CURRENT TOPIC (use as loose guide, don't read verbatim): "${currentTopic?.text || "wrap up"}"
${nextTopic ? `NEXT TOPIC (if advancing): "${nextTopic.text}"` : "This is the last topic."}

Topics pushed on so far for this question: ${Math.max(0, currentQuestionIndex - (sessionPlan.questions.findIndex(q => q === currentTopic) || 0))} pushbacks
If you've pushed back on this topic twice already: advance regardless.

React to what they said. Then move the conversation forward.`;

  // ── Fallback builder ─────────────────────────────────────────────────────────
  function buildFallback(reason) {
    if (isGreeting) {
      return {
        nextPersona: assignedP.name, voiceId: assignedP.voiceId,
        line: `Hey, great to meet you — I'm ${assignedP.name}, ${assignedP.role}. ${currentTopic?.text || "Let's get into it."}`,
        intent: "Greeting fallback", sessionAdvancing: false, sessionComplete: false,
        userPerformanceNote: "Greeting with LLM fallback",
      };
    }
    const nextIndex = currentQuestionIndex + 1;
    const nextQ = sessionPlan.questions[nextIndex];
    const isLast = !nextQ;
    const p = personas.find(x => x.name === (nextQ?.assignedPersona || personas[0].name)) || personas[0];
    return {
      nextPersona: p.name, voiceId: p.voiceId,
      line: isLast ? "That's everything — thank you for your time." : nextQ.text,
      intent: `Fallback — ${reason}`, sessionAdvancing: true, sessionComplete: isLast,
      userPerformanceNote: reason,
    };
  }

  // ── LLM call ──────────────────────────────────────────────────────────────────
  let raw;
  try {
    raw = await callLLMStream({ systemPrompt, userPrompt, maxTokens: 500, onChunk: () => {} });
  } catch (err) {
    console.error("[judge] LLM error:", err.message);
    // If fallback session, generate a dynamic question instead of raw session plan text
    if (_isFallback) {
      try {
        const dynRaw = await callLLM({
          systemPrompt: `You are ${assignedP.name}, ${assignedP.role} for: "${situation}". React briefly to what was said and ask one follow-up question specific to this situation. 2 sentences max. Return ONLY JSON: {"line": "..."}`,
          userPrompt: `They said: "${transcript}". Current topic: "${currentTopic?.text}"`,
          maxTokens: 100,
        });
        const dynResult = parseJSON(dynRaw);
        if (dynResult?.line) {
          return { nextPersona: assignedP.name, voiceId: assignedP.voiceId, line: dynResult.line, intent: "Dynamic fallback", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "LLM retry" };
        }
      } catch {}
    }
    return buildFallback("LLM unavailable");
  }

  const result = parseJSON(raw);
  if (!result?.line) {
    console.error("[judge] bad parse:", raw?.slice(0, 150));
    return buildFallback("parse error");
  }

  // Enforce 3-sentence max
  const sentences = result.line.match(/[^.!?]+[.!?]+/g) || [result.line];
  result.line = sentences.slice(0, 3).join(" ").trim();

  return result;
}
