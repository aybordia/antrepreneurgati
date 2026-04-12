// PROMPT VERSION: 1.0
import { callLLM, callLLMStream, parseJSON } from "../lib/llm.js";
import { VOICE_IDS, resolveVoiceId } from "../lib/elevenlabs.js";

const SYSTEM_PROMPT = `You are the Session Architect. Design a practice session. Output ONLY valid JSON, no markdown:
{"agent":"Architect","sessionSummary":"1 sentence","psychologicalProfile":"1 sentence","diagnosedWeakness":"1 sentence","personas":[{"name":"UNIQUE name NOT Alex/Jordan/Morgan","role":"specific role","voiceId":"from VOICE_IDS","color":"#7B6CFF","orbIndex":0,"style":"1 sentence"},{"name":"...","role":"...","voiceId":"...","color":"#F5A623","orbIndex":1,"style":"..."},{"name":"...","role":"...","voiceId":"...","color":"#6ee7b7","orbIndex":2,"style":"..."}],"sessionPlan":{"difficultyProgression":"escalating","totalEstimatedMinutes":5,"questions":[{"text":"topic intent","assignedPersona":"name","intent":"string"},{"text":"...","assignedPersona":"...","intent":"..."},{"text":"...","assignedPersona":"...","intent":"..."},{"text":"...","assignedPersona":"...","intent":"..."}]},"openingLine":"","closingCondition":"After all topics covered"}

Rules: exactly 3 personas, exactly 4 questions escalating in difficulty, voiceId from: ${JSON.stringify(VOICE_IDS)}. JSON only.`;

export async function runArchitect({ situation, researcherOutput, styleHint, researchContext }, writeChunk) {
  writeChunk({ agent: "Architect", chunk: "Designing your session…", thinking: true });

  const rc = researcherOutput || {};
  const clip = (s, n = 80) => s && s.length > n ? s.slice(0, n) + "…" : (s || "");
  const userPrompt = `Situation: "${situation}"
Patterns: ${clip(rc.interviewerPatterns)}
Weakness: ${clip(rc.diagnosedWeakness || (rc.keyFindings?.[0]?.insight) || "")}
Output JSON now.`;

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
        systemPrompt: `Given a situation, output 4 interview topic intents as short phrases. Return ONLY: {"intents":["...","...","...","..."]}`,
        userPrompt: `Situation: "${situation}"`,
        maxTokens: 120,
      });
      const liteResult = parseJSON(liteRaw);
      if (liteResult?.intents?.length >= 3) {
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

  const staticQuestions = [
    { text: "motivation and opening context",            assignedPersona: fallbackPersonas[0].name, intent: "Warm-up" },
    { text: "the specific challenge or weak point",      assignedPersona: fallbackPersonas[1].name, intent: "Probe" },
    { text: "handling pushback or unexpected pressure",  assignedPersona: fallbackPersonas[2].name, intent: "Curveball" },
    { text: "concrete plan and next steps",              assignedPersona: fallbackPersonas[0].name, intent: "Closing" },
  ];

  // Skip LLM entirely — instant. Judge is fully generative, no LLM needed here.
  writeChunk({ agent: "Architect", chunk: "Session architected.", streamStart: true });

  const sessionData = {
    agent: "Architect",
    sessionSummary: `Practice session for: ${situation}`,
    personas: fallbackPersonas,
    sessionPlan: { difficultyProgression: "escalating", totalEstimatedMinutes: 5, questions: staticQuestions },
    openingLine: "",
    closingCondition: "After all topics are covered.",
    researchContext: {
      ...researchContext,
      psychologicalProfile: "",
      diagnosedWeakness: researchContext?.interviewerPatterns?.slice(0, 80) || "",
    },
  };

  writeChunk({ agent: "Architect", done: true, sessionData });
  return sessionData;
}
