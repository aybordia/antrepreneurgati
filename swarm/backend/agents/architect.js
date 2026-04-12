// PROMPT VERSION: 1.0
import { callLLM, callLLMStream, parseJSON } from "../lib/llm.js";
import { VOICE_IDS, resolveVoiceId } from "../lib/elevenlabs.js";

const SYSTEM_PROMPT = `You are the Session Architect. Given a situation and research, design the full practice session.

You must also infer:
- WHO the interviewers are (names, roles, personalities specific to this situation)
- WHAT the user's weak spot is and how to probe it
- WHICH voices fit each persona

Output ONLY valid JSON:
{
  "agent": "Architect",
  "sessionSummary": "string — 2 sentences specific to this user's situation",
  "psychologicalProfile": "string — what the interviewer is really evaluating",
  "diagnosedWeakness": "string — the user's likely weak spot based on their situation",
  "personas": [
    {
      "name": "string — UNIQUE realistic name fitting this situation (NOT Alex/Jordan/Morgan)",
      "role": "string — specific institutional role",
      "voiceId": "string — from VOICE_IDS map",
      "color": "string — hex",
      "orbIndex": 0,
      "style": "string — 1 sentence behavioral description"
    }
  ],
  "sessionPlan": {
    "difficultyProgression": "escalating",
    "totalEstimatedMinutes": 5,
    "questions": [
      {
        "text": "string — specific question for this situation",
        "assignedPersona": "string — matches personas[].name",
        "intent": "string",
        "followUpTriggers": [],
        "curveballAfter": false,
        "suggestedFollowUp": "string"
      }
    ]
  },
  "openingLine": "",
  "closingCondition": "After all topics covered"
}

Rules:
- personas: exactly 3, with UNIQUE names that fit this specific situation
- questions: 6-8, escalating difficulty
- voiceId must come from: ${JSON.stringify(VOICE_IDS)}
- Colors: #7B6CFF, #F5A623, #6ee7b7 in that order
- No preamble. No markdown. JSON only.`;

export async function runArchitect({ situation, researcherOutput, styleHint, researchContext }, writeChunk) {
  writeChunk({ agent: "Architect", chunk: "Designing your session…", thinking: true });

  const rc = researcherOutput || {};
  const userPrompt = `Situation: "${situation}"

Research findings:
- Interviewer patterns: ${rc.interviewerPatterns || ""}
- Success patterns: ${rc.successPatterns || ""}
- Key insights: ${(rc.keyFindings || []).slice(0, 3).map(f => f.insight || f).join(" | ")}
${styleHint ? `\nUser preferences: ${styleHint}` : ""}

Design the full session. Infer the interviewer psychology, the user's weak spot, and create 3 UNIQUE personas with realistic names specific to this situation. Generate specific questions from the research.`;

  // Build situation-aware fallback personas so the session feels right
  // even when the Architect LLM call fails
  function buildFallbackPersonas(situation) {
    const s = situation.toLowerCase();
    if (/mit|harvard|stanford|yale|princeton|college|university|admissions|application/i.test(s)) {
      return [
        { name: "Dr. Reeves",    role: "Admissions Officer",  voiceId: VOICE_IDS["Adam"],   color: "#7B6CFF", orbIndex: 0, style: "Thoughtful and intellectually probing." },
        { name: "Maya Thornton", role: "Alumni Interviewer",  voiceId: VOICE_IDS["Rachel"], color: "#F5A623", orbIndex: 1, style: "Warm but pushes for genuine depth." },
        { name: "Prof. Okafor",  role: "Faculty Representative", voiceId: VOICE_IDS["Arnold"], color: "#6ee7b7", orbIndex: 2, style: "Challenges assumptions, values precision." },
      ];
    }
    if (/parent|mom|dad|family|home|guardian/i.test(s)) {
      return [
        { name: "Your Father",  role: "Parent",        voiceId: VOICE_IDS["Adam"],   color: "#7B6CFF", orbIndex: 0, style: "Direct, protective, hard to convince." },
        { name: "Your Mother",  role: "Parent",        voiceId: VOICE_IDS["Rachel"], color: "#F5A623", orbIndex: 1, style: "Emotional, invested, wants reassurance." },
        { name: "Aunt Sandra",  role: "Family Mediator", voiceId: VOICE_IDS["Gigi"],   color: "#6ee7b7", orbIndex: 2, style: "Balanced, asks the hard practical questions." },
      ];
    }
    if (/google|amazon|meta|apple|microsoft|netflix|faang|software|engineer|swe|sde/i.test(s)) {
      return [
        { name: "Sarah Chen",    role: "Engineering Manager",  voiceId: VOICE_IDS["Rachel"], color: "#7B6CFF", orbIndex: 0, style: "Systems-focused, expects concrete tradeoffs." },
        { name: "Dev Patel",     role: "Senior SWE Interviewer", voiceId: VOICE_IDS["Josh"],   color: "#F5A623", orbIndex: 1, style: "Technical and precise, probes edge cases." },
        { name: "Marcus Webb",   role: "Tech Lead",             voiceId: VOICE_IDS["Arnold"], color: "#6ee7b7", orbIndex: 2, style: "Challenges vague answers with follow-ups." },
      ];
    }
    if (/investor|vc|venture|pitch|startup|founder/i.test(s)) {
      return [
        { name: "Natalie Cross",  role: "General Partner",    voiceId: VOICE_IDS["Rachel"], color: "#7B6CFF", orbIndex: 0, style: "Skeptical, pattern-matches quickly." },
        { name: "James Liu",      role: "Principal",          voiceId: VOICE_IDS["Josh"],   color: "#F5A623", orbIndex: 1, style: "Digs into numbers and defensibility." },
        { name: "Priya Sharma",   role: "Analyst",            voiceId: VOICE_IDS["Gigi"],   color: "#6ee7b7", orbIndex: 2, style: "Asks the naive question that cuts deepest." },
      ];
    }
    if (/medical|doctor|hospital|clinical|residency|fellowship|nursing/i.test(s)) {
      return [
        { name: "Dr. Patel",      role: "Program Director",   voiceId: VOICE_IDS["Adam"],   color: "#7B6CFF", orbIndex: 0, style: "Evaluates clinical reasoning and composure." },
        { name: "Dr. Williams",   role: "Senior Physician",   voiceId: VOICE_IDS["Arnold"], color: "#F5A623", orbIndex: 1, style: "Scenario-based, tests under pressure." },
        { name: "Dr. Nakamura",   role: "Department Chair",   voiceId: VOICE_IDS["Rachel"], color: "#6ee7b7", orbIndex: 2, style: "Probes empathy and ethical decision-making." },
      ];
    }
    // Default: general professional interview
    return [
      { name: "Elena Vasquez",  role: "Senior Director",    voiceId: VOICE_IDS["Rachel"], color: "#7B6CFF", orbIndex: 0, style: "Direct, evaluates leadership potential." },
      { name: "Omar Hassan",    role: "Panel Interviewer",  voiceId: VOICE_IDS["Arnold"], color: "#F5A623", orbIndex: 1, style: "Warm but pushes for specifics." },
      { name: "Tina Marchetti", role: "Domain Specialist",  voiceId: VOICE_IDS["Gigi"],   color: "#6ee7b7", orbIndex: 2, style: "Asks the unexpected, tests adaptability." },
    ];
  }

  const fallbackPersonas = buildFallbackPersonas(situation);

  // Build a fallback session using a lite LLM call so questions are always situation-specific.
  // The "text" field here is a THEME INTENT for judgeOrchestrator, never spoken verbatim.
  async function buildDynamicFallback() {
    try {
      const liteRaw = await callLLM({
        systemPrompt: `You are a session designer. Given a situation, produce 6 interview/conversation topic intents. Each intent is a SHORT phrase describing what to probe — NOT a full question. Return ONLY valid JSON: {"intents": ["string", ...]}`,
        userPrompt: `Situation: "${situation}"\nOutput 6 topic intents, escalating in difficulty. Be specific to this exact situation.`,
        maxTokens: 300,
      });
      const liteResult = parseJSON(liteRaw);
      if (liteResult?.intents?.length >= 5) {
        return liteResult.intents.map((intent, i) => ({
          text: intent,   // judgeOrchestrator uses this as theme, never reads it aloud
          assignedPersona: fallbackPersonas[i % fallbackPersonas.length].name,
          intent,
          followUpTriggers: [],
          curveballAfter: i === 3,
          suggestedFollowUp: "",
        }));
      }
    } catch (e) {
      console.error("[architect] lite question gen failed:", e.message);
    }
    // Absolute last resort: abstract themes with no question mark — cannot be read as a script
    return [
      { text: "motivation and what is at stake",          assignedPersona: fallbackPersonas[1].name, intent: "Warm-up",        followUpTriggers: [], curveballAfter: false, suggestedFollowUp: "" },
      { text: "the specific challenge or weak point",     assignedPersona: fallbackPersonas[0].name, intent: "Probe weakness", followUpTriggers: [], curveballAfter: false, suggestedFollowUp: "" },
      { text: "counter-arguments and self-awareness",     assignedPersona: fallbackPersonas[0].name, intent: "Steel-man",      followUpTriggers: [], curveballAfter: false, suggestedFollowUp: "" },
      { text: "handling pushback or unexpected pressure", assignedPersona: fallbackPersonas[2].name, intent: "Curveball",      followUpTriggers: [], curveballAfter: true,  suggestedFollowUp: "" },
      { text: "concrete plan and next steps",             assignedPersona: fallbackPersonas[1].name, intent: "Closing",        followUpTriggers: [], curveballAfter: false, suggestedFollowUp: "" },
    ];
  }

  let raw;
  try {
    let isFirst = true;
    raw = await callLLMStream({
      systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 1200,
      onChunk: (tok) => {
        writeChunk({ agent: "Architect", chunk: tok, streamStart: isFirst });
        isFirst = false;
      },
    });
  } catch (err) {
    console.error("[architect] LLM error:", err.message);
    const questions = await buildDynamicFallback();
    const fallback = {
      agent: "Architect",
      sessionSummary: `Practice session for: ${situation}`,
      personas: fallbackPersonas,
      sessionPlan: { difficultyProgression: "escalating", totalEstimatedMinutes: 5, questions },
      openingLine: "",
      closingCondition: "After all topics are covered.",
      _isFallback: true,
      researchContext,
    };
    writeChunk({ agent: "Architect", done: true, sessionData: fallback });
    return fallback;
  }

  let parsed = parseJSON(raw);

  // Fall back to dynamic session if parse failed or personas are missing
  if (!parsed || !parsed.personas || parsed.personas.length !== 3) {
    console.error("[architect] bad output (personas:", parsed?.personas?.length, ") — using dynamic fallback");
    const questions = await buildDynamicFallback();
    const fallback = {
      agent: "Architect",
      sessionSummary: `Practice session for: ${situation}`,
      personas: fallbackPersonas,
      sessionPlan: { difficultyProgression: "escalating", totalEstimatedMinutes: 5, questions },
      openingLine: "",
      closingCondition: "After all topics are covered.",
      _isFallback: true,
      researchContext,
    };
    writeChunk({ agent: "Architect", done: true, sessionData: fallback });
    return fallback;
  }

  // Ensure voiceIds are resolved correctly
  parsed.personas = parsed.personas.map((p) => ({
    ...p,
    voiceId: Object.values(VOICE_IDS).includes(p.voiceId) ? p.voiceId : resolveVoiceId(p.voiceId),
  }));

  // Merge architect's inferred fields into researchContext for the judge
  parsed.researchContext = {
    ...researchContext,
    psychologicalProfile: parsed.psychologicalProfile || "",
    diagnosedWeakness:    parsed.diagnosedWeakness    || "",
  };

  writeChunk({ agent: "Architect", done: true, sessionData: parsed });

  return parsed;
}
