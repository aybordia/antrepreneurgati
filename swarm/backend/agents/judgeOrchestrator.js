// PROMPT VERSION: 3.0 — truly conversational, reactive-first
import { callLLM, callLLMStream, parseJSON } from "../lib/llm.js";

export async function runJudgeOrchestrator({ transcript, sessionContext, history, currentQuestionIndex = 0 }) {
  const parsed = typeof sessionContext === "string" ? JSON.parse(sessionContext) : sessionContext;
  const { personas, sessionPlan, situation, _isFallback, researchContext } = parsed;

  // Build a research block from Tavily/agent findings to ground every response
  const rc = researchContext || {};
  const researchBlock = [
    rc.interviewerPatterns  && `INTERVIEWER PATTERNS (from research): ${rc.interviewerPatterns}`,
    rc.successPatterns      && `WHAT WORKS FOR CANDIDATES: ${rc.successPatterns}`,
    rc.psychologicalProfile && `INTERVIEWER PSYCHOLOGY: ${rc.psychologicalProfile}`,
    rc.pushbackStyle        && `HOW THEY PUSH BACK: ${rc.pushbackStyle}`,
    rc.diagnosedWeakness    && `USER'S DIAGNOSED WEAKNESS: ${rc.diagnosedWeakness}`,
    rc.warningSignals?.length && `WARNING SIGNALS TO WATCH FOR: ${rc.warningSignals.join("; ")}`,
    rc.keyFindings?.length  && `KEY RESEARCH FINDINGS: ${rc.keyFindings.join(" | ")}`,
  ].filter(Boolean).join("\n");

  // ── Opening turn ────────────────────────────────────────────────────────────
  if (!transcript && history.length === 0) {
    const firstTopic = sessionPlan.questions[0];
    const p = personas.find(x => x.name === firstTopic?.assignedPersona) || personas[0];

    try {
      const raw = await callLLM({
        systemPrompt: `You are ${p.name}, ${p.role}. Your style: ${p.style}
You are opening a live practice session for someone preparing for: "${situation}"
${researchBlock ? `Research context — use this to sound knowledgeable:\n${researchBlock}\n` : ""}
Introduce yourself in one natural sentence. Then ask ONE specific, incisive opening question that fits THIS exact situation.
Rules:
- Never ask "what's at stake for you" or "what's driving you" — those are generic filler.
- Your question must reference something concrete about: "${situation}"
- Sound like a real ${p.role} who has done this many times, not a chatbot reading from a list.
Return ONLY valid JSON: {"line": "your full opening"}`,
        userPrompt: `Situation: "${situation}"`,
        maxTokens: 160,
      });
      const result = parseJSON(raw);
      if (result?.line) {
        return { nextPersona: p.name, voiceId: p.voiceId, line: result.line, intent: "Opening", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "Session started" };
      }
    } catch (err) {
      console.error("[judge] opening error:", err.message);
    }

    // Fallback opening — never read firstTopic text verbatim
    return {
      nextPersona: p.name, voiceId: p.voiceId,
      line: `Hi, I'm ${p.name} — ${p.role}. I've looked over the situation. Let's get into it.`,
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

  // Detect greeting — only fire if the message is JUST a greeting (≤4 words),
  // not if the user's answer happens to start with "Hi" followed by real content.
  const trimmedTranscript = (transcript || "").trim();
  const isGreeting =
    trimmedTranscript.split(/\s+/).filter(Boolean).length <= 4 &&
    /^(hi+|hello+|hey+|good\s*(morning|afternoon|evening)|howdy)\b/i.test(trimmedTranscript);

  const systemPrompt = `You are ${assignedP.name}, ${assignedP.role}.
Your style: ${assignedP.style}
You are conducting a live practice session for: "${situation}"
${researchBlock ? `\nRESEARCH CONTEXT — use this to sound like you actually know this domain:\n${researchBlock}\n` : ""}
HOW YOU RESPOND — non-negotiable rules:
1. NEVER output a pre-written question verbatim. The session plan is a theme guide, not a script.
2. ALWAYS start by reacting to a SPECIFIC word, phrase, or idea from what the user just said.
   - Quote or paraphrase something they said: "You mentioned X — let's go deeper on that."
   - If vague: "You said [their vague phrase] — what does that actually mean in practice?"
   - If stumbled: "You trailed off when you got to X — that's exactly where I want to push."
   - If just a greeting: Introduce yourself warmly, then ask one easy opening question.
   Never react generically. Never say "Great answer!" or re-ask the same question.
3. THEN advance (1-2 sentences max): dig in, push back, or naturally transition.
4. EVERY word must be specific to: "${situation}". Generic = failure.

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

  // For fallback sessions, only show the intent — never the question text (which is a theme, not a script)
  const topicGuide = _isFallback
    ? `CURRENT INTENT: ${currentTopic?.intent || "continue the conversation"}`
    : `TOPIC THEME (direction only — do NOT quote this): "${currentTopic?.text || "wrap up"}"`;
  const nextTopicGuide = _isFallback
    ? (nextTopic ? `NEXT INTENT (if advancing): ${nextTopic.intent}` : "Last topic — wrap up naturally.")
    : (nextTopic ? `NEXT TOPIC THEME (if advancing): "${nextTopic.text}"` : "This is the last topic — wrap up naturally.");

  const userPrompt = `CONVERSATION SO FAR:
${recentHistory}

USER JUST SAID: "${transcript}"
${isGreeting ? "⚠️ Pure greeting — introduce yourself warmly, then ask one easy opening question." : ""}

CRITICAL: Do NOT repeat or paraphrase the topic/intent text below. React DIRECTLY to what the user just said.
- Quote or reference something specific they mentioned, then dig into it or push back.
- Use the topic/intent only to know what direction to steer toward, not what to say.

${topicGuide}
${nextTopicGuide}

If you've pushed back on this topic twice already: advance regardless.

React to their actual words. Every sentence must be specific to this situation and this conversation.`;

  // ── LLM call ──────────────────────────────────────────────────────────────────
  let raw;
  try {
    raw = await callLLMStream({ systemPrompt, userPrompt, maxTokens: 500, onChunk: () => {} });
  } catch (err) {
    console.error("[judge] LLM error:", err.message);
    // Recovery: small targeted call — react to what the user said + steer toward current intent
    try {
      const recoverRaw = await callLLM({
        systemPrompt: `You are ${assignedP.name}, ${assignedP.role}. You are conducting a practice session about: "${situation}".
${isGreeting ? `They are greeting you. Introduce yourself warmly (1 sentence), then ease into the conversation with a soft opening question relevant to: "${situation}".` : "React to what the user just said and ask ONE specific follow-up. Reference something specific from their words."}
2 sentences max. Return ONLY JSON: {"line": "..."}`,
        userPrompt: `They said: "${transcript}".\nConversation so far:\n${recentHistory}\nTopic direction: ${currentTopic?.intent || currentTopic?.text || "continue"}`,
        maxTokens: 120,
      });
      const recoverResult = parseJSON(recoverRaw);
      if (recoverResult?.line) {
        return { nextPersona: assignedP.name, voiceId: assignedP.voiceId, line: recoverResult.line, intent: "Recovery", sessionAdvancing: false, sessionComplete: false, userPerformanceNote: "LLM recovery" };
      }
    } catch {}
    // True last resort: echo something the user said so the response is always contextual
    const userWords = (transcript || "").trim().split(/\s+/).slice(0, 6).join(" ");
    const isLast = currentQuestionIndex >= sessionPlan.questions.length - 1;
    return {
      nextPersona: assignedP.name, voiceId: assignedP.voiceId,
      line: isLast
        ? "That covers what I wanted to explore. Thank you for your time."
        : (userWords ? `You mentioned "${userWords}" — say more about that.` : "Tell me more about that."),
      intent: "Last resort fallback", sessionAdvancing: false, sessionComplete: isLast,
      userPerformanceNote: "LLM unavailable",
    };
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
