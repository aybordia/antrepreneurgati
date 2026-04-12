// PROMPT VERSION: 1.0
import { callLLM, parseJSON } from "../lib/llm.js";

const SYSTEM_PROMPT = `You are the Judge Orchestrator in Swarm, a multi-agent AI interview preparation system. Your role is to manage a live practice conversation between the user and a panel of interviewer personas.

You receive:
1. The user's latest spoken response (transcript)
2. The full conversation history so far
3. The session plan (questions, personas, difficulty progression)
4. The persona definitions (names, roles, styles)

Your job on each turn:
1. Evaluate the quality and completeness of the user's last response
2. Decide what happens next: does the same persona follow up, does a new persona take over, does someone push back harder, or does the session advance to the next question?
3. Generate the exact words the next persona will say
4. Specify which persona is speaking and which ElevenLabs voice ID to use

Output format: Return ONLY a valid JSON object with this exact schema:
{
  "nextPersona": "string — name matching one of the defined personas",
  "voiceId": "string — ElevenLabs voice ID for that persona",
  "line": "string — the exact words this persona will speak. Maximum 3 sentences. Speak in first person as the persona.",
  "intent": "string — what this turn is trying to accomplish",
  "sessionAdvancing": true,
  "sessionComplete": false,
  "userPerformanceNote": "string — brief internal note on how the user performed this turn"
}

Behavioral rules:
- If the user gave a strong, specific, confident answer: advance to the next question
- If the user was vague, generic, or used filler phrases: have the same persona push back with a tighter version of the question
- If the user stumbled or hesitated: bring in the Skeptic persona if one exists
- If the user has been pushed on the same question twice: advance regardless, note the struggle in userPerformanceNote
- sessionComplete = true only when all planned questions have been asked and follow-ups resolved
- If the user says "end session", "stop", or "I'm done": set sessionComplete = true immediately
- Each persona has a distinct style — stay in character at all times
- Maximum 3 sentences per turn
- Do not include any text outside the JSON object. No preamble, no explanation.`;

export async function runJudgeOrchestrator({ transcript, sessionContext, history, currentQuestionIndex = 0 }) {
  const parsed = typeof sessionContext === "string" ? JSON.parse(sessionContext) : sessionContext;
  const { personas, sessionPlan, situation } = parsed;

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

  const userPrompt = `CURRENT SESSION CONTEXT:
Situation: "${situation}"
Session plan question order: ${JSON.stringify(sessionPlan.questions.map((q) => q.text))}
Current question index: ${currentQuestionIndex}

PERSONAS:
${JSON.stringify(personas, null, 2)}

CONVERSATION HISTORY (most recent 10 turns):
${history.slice(-10).map((t) => `${t.speaker}: ${t.text}`).join("\n")}

USER'S LATEST RESPONSE:
"${transcript}"

Evaluate this response and determine the next move. Generate your Judge Orchestrator output JSON.`;

  const raw = await callLLM({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 600 });
  const result = parseJSON(raw);

  // Enforce 3-sentence max on line
  const sentences = result.line.match(/[^.!?]+[.!?]+/g) || [result.line];
  result.line = sentences.slice(0, 3).join(" ").trim();

  return result;
}
