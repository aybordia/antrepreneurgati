// PROMPT VERSION: 2.0
import { callLLM, callLLMStream, parseJSON } from "../lib/llm.js";

// Build a context-rich system prompt for THIS specific session
function buildSystemPrompt({ situation, personas }) {
  const personaDescriptions = personas
    .map(p => `- ${p.name} (${p.role}): ${p.style}`)
    .join("\n");

  return `You are managing a live, realistic practice conversation for someone preparing for the following:

SITUATION: "${situation}"

You are playing one of these personas on each turn:
${personaDescriptions}

YOUR JOB:
- Respond naturally as the assigned persona — speak like a real human, not a chatbot
- React directly to what the user just said before moving to the next topic
- Stay in character: an MIT admissions interviewer sounds nothing like a Google engineering manager or a concerned parent
- The session plan gives you TOPICS to cover — never read them verbatim. Rephrase them in your persona's natural voice, woven into the flow of the conversation
- If the user just greeted you, greet them warmly and introduce yourself before asking anything
- If they said something interesting, acknowledge it genuinely before pushing forward
- If they fumbled, gently push back in your persona's style — don't just re-ask the same question
- Keep every turn to 2-3 sentences max — leave space for the user to speak

Output format: Return ONLY valid JSON, no preamble, no explanation:
{
  "nextPersona": "string — name matching one of the defined personas",
  "voiceId": "string — ElevenLabs voice ID for that persona",
  "line": "string — what this persona says. Max 3 sentences. First person. Natural, human tone.",
  "intent": "string — what this turn accomplishes",
  "sessionAdvancing": true or false,
  "sessionComplete": true or false,
  "userPerformanceNote": "string — brief note on how the user did this turn"
}

RULES:
- sessionAdvancing: true when moving to the next topic/question in the plan
- sessionAdvancing: false when following up on the same topic
- sessionComplete: true only after all planned topics are covered
- If user says "stop", "end session", or "I'm done": sessionComplete = true
- If the same topic has been pushed on twice already: advance regardless
- NEVER produce a line that could apply to any generic interview — it must be specific to the situation above`;
}

// When Architect falls back to generic questions, generate them on-the-fly from the situation
async function generateDynamicQuestion({ situation, personas, currentQuestionIndex, history }) {
  const questionNumber = currentQuestionIndex + 1;
  const persona = personas[currentQuestionIndex % personas.length];
  const recentTopics = history
    .filter(t => t.speaker !== "You")
    .slice(-4)
    .map(t => t.text)
    .join(" | ");

  const prompt = `You are ${persona.name} (${persona.role}) conducting a "${situation}" practice session.

This is question ${questionNumber} in the conversation.
Recent topics already covered: ${recentTopics || "none yet — this is the opening"}.

Generate ONE natural question that:
- Is SPECIFIC to "${situation}" — could not apply to any other scenario
- Builds on what's been discussed
- Fits the ${persona.role}'s perspective and style: "${persona.style}"
- Gets progressively harder (question ${questionNumber} of ~6)

Return only JSON: {"question": "the question text", "intent": "what it tests"}`;

  try {
    const raw = await callLLM({
      systemPrompt: "Generate a single interview question. Return only valid JSON.",
      userPrompt: prompt,
      maxTokens: 120,
    });
    const result = parseJSON(raw);
    return result?.question || null;
  } catch {
    return null;
  }
}

export async function runJudgeOrchestrator({ transcript, sessionContext, history, currentQuestionIndex = 0 }) {
  const parsed = typeof sessionContext === "string" ? JSON.parse(sessionContext) : sessionContext;
  const { personas, sessionPlan, openingLine, situation, _isFallback } = parsed;

  // Opening turn: LLM generates a natural, situation-specific greeting
  if (!transcript && history.length === 0) {
    const firstQ = sessionPlan.questions[0];
    const assignedPersona = personas.find(p => p.name === firstQ?.assignedPersona) || personas[0];

    // Use LLM for a situation-specific opening rather than hardcoded text
    try {
      const openingPrompt = `You are ${assignedPersona.name}, ${assignedPersona.role}. You are about to begin a practice session with someone preparing for: "${situation}".

Write your opening line — greet them warmly, introduce yourself briefly, and ease into the first topic: "${firstQ?.text || "tell me about yourself"}". Keep it to 2-3 sentences. Sound like a real ${assignedPersona.role}, not a generic interviewer. Return ONLY a JSON object: {"line": "your opening line here"}`;

      const raw = await callLLM({ systemPrompt: "You generate natural, human opening lines for practice conversations. Return only valid JSON.", userPrompt: openingPrompt, maxTokens: 150 });
      const result = parseJSON(raw);
      if (result?.line) {
        return {
          nextPersona: assignedPersona.name,
          voiceId: assignedPersona.voiceId,
          line: result.line,
          intent: "Opening — situation-specific greeting",
          sessionAdvancing: false,
          sessionComplete: false,
          userPerformanceNote: "Session just started",
        };
      }
    } catch (err) {
      console.error("[judgeOrchestrator] opening LLM error:", err.message);
    }

    // Fallback opening if LLM fails
    const fallbackLine = openingLine
      ? `${openingLine} ${firstQ?.text || ""}`.trim()
      : firstQ?.text || "Welcome. Let's get started.";
    return {
      nextPersona: assignedPersona.name,
      voiceId: assignedPersona.voiceId,
      line: fallbackLine,
      intent: "Opening — fallback",
      sessionAdvancing: false,
      sessionComplete: false,
      userPerformanceNote: "Session just started",
    };
  }

  // Hard limit: force end if session has gone too long
  if (currentQuestionIndex >= (sessionPlan.questions.length + 3)) {
    return {
      nextPersona: personas[0].name,
      voiceId: personas[0].voiceId,
      line: "Thank you — that concludes our session today. You'll receive your debrief shortly.",
      intent: "Force session end",
      sessionAdvancing: false,
      sessionComplete: true,
      userPerformanceNote: "Session force-ended at question limit",
    };
  }

  // If Architect fell back to generic questions, generate a situation-specific one live
  let currentQuestion = sessionPlan.questions[currentQuestionIndex];
  if (_isFallback) {
    const dynamic = await generateDynamicQuestion({ situation, personas, currentQuestionIndex, history });
    if (dynamic) {
      currentQuestion = { ...currentQuestion, text: dynamic, intent: "Dynamically generated for this situation" };
    }
  }
  const assignedPersona = personas.find(p => p.name === currentQuestion?.assignedPersona) || personas[0];

  // Detect if user is greeting rather than answering
  const isGreeting = /^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|yo)\b/i.test(transcript?.trim() || "");

  const userPrompt = `SITUATION: "${situation}"

CURRENT TOPIC TO EXPLORE (do NOT say verbatim — rephrase naturally in your persona's voice):
"${currentQuestion?.text || "wrap up the session"}"
Topic intent: ${currentQuestion?.intent || "closing"}
Assigned persona for this topic: ${assignedPersona?.name} (${assignedPersona?.role})

PERSONAS AVAILABLE:
${personas.map(p => `${p.name}: ${p.role} — ${p.style}`).join("\n")}

CONVERSATION SO FAR (last 8 turns):
${history.slice(-8).map(t => `${t.speaker}: ${t.text}`).join("\n")}

USER JUST SAID: "${transcript}"
${isGreeting ? "\n⚠️ The user is greeting you — respond with a warm greeting and natural introduction first. Do not jump straight to a question." : ""}

How did they do? ${isGreeting ? "N/A — greeting turn." : "Strong/specific → sessionAdvancing: true. Vague/filler → sessionAdvancing: false, push back. Pushed twice on this topic already → advance anyway."}

Generate your response as the assigned persona. Make it specific to "${situation}" — a response that could ONLY make sense in this exact context.`;

  // Helper: advance to next question as fallback
  function advanceFallback(reason) {
    // Greeting: respond warmly instead of firing the next question cold
    if (isGreeting) {
      const p = assignedPersona || personas[0];
      return {
        nextPersona: p.name,
        voiceId: p.voiceId,
        line: `Hi, great to meet you! I'm ${p.name}, your ${p.role} today. Let's get started — ${currentQuestion?.text || "tell me a bit about yourself."}`,
        intent: "Greeting fallback",
        sessionAdvancing: false,
        sessionComplete: false,
        userPerformanceNote: "Greeting with LLM fallback",
      };
    }
    const nextIndex = currentQuestionIndex + 1;
    const nextQ = sessionPlan.questions[nextIndex];
    const isLast = !nextQ;
    const p = personas.find(x => x.name === (nextQ?.assignedPersona || personas[0].name)) || personas[0];
    return {
      nextPersona: p.name,
      voiceId: p.voiceId,
      line: isLast
        ? "That's everything I wanted to cover. Thanks for your time today."
        : nextQ.text,
      intent: `Fallback advance — ${reason}`,
      sessionAdvancing: true,
      sessionComplete: isLast,
      userPerformanceNote: reason,
    };
  }

  let raw;
  try {
    raw = await callLLMStream({
      systemPrompt: buildSystemPrompt({ situation, personas }),
      userPrompt,
      maxTokens: 600,
      onChunk: () => {},
    });
  } catch (err) {
    console.error("[judgeOrchestrator] LLM error:", err.message);
    return advanceFallback("LLM unavailable");
  }

  const result = parseJSON(raw);

  if (!result || !result.line) {
    console.error("[judgeOrchestrator] bad parse result:", raw?.slice(0, 200));
    return advanceFallback("parse error");
  }

  // Enforce 3-sentence max
  const sentences = result.line.match(/[^.!?]+[.!?]+/g) || [result.line];
  result.line = sentences.slice(0, 3).join(" ").trim();

  return result;
}
