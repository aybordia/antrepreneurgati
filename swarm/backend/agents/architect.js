// PROMPT VERSION: 1.0
import { callLLMStream, parseJSON } from "../lib/llm.js";
import { VOICE_IDS, resolveVoiceId } from "../lib/elevenlabs.js";

const SYSTEM_PROMPT = `You are the Architect agent in a multi-agent AI system called Swarm. You run after all other agents have completed.

Your job: Read the complete research and analysis from the other four agents and design the optimal practice session structure for this specific user. You are the director of the experience.

Output format: Return ONLY a valid JSON object with this exact schema:
{
  "agent": "Architect",
  "sessionSummary": "string — 2 sentences on what this session is designed to accomplish for this specific user",
  "personas": [
    {
      "name": "string — from Profiler",
      "role": "string — their institutional role",
      "voiceId": "string — ElevenLabs voice ID",
      "color": "string — hex color",
      "orbIndex": 0,
      "style": "string — 1 sentence behavioral description"
    }
  ],
  "sessionPlan": {
    "difficultyProgression": "linear or escalating or wave",
    "totalEstimatedMinutes": 5,
    "questions": [
      {
        "text": "string — exact question to ask",
        "assignedPersona": "string — must match one of personas[].name",
        "intent": "string — what this question is testing",
        "followUpTriggers": ["string"],
        "curveballAfter": false,
        "suggestedFollowUp": "string — harder follow-up if user stumbles"
      }
    ]
  },
  "openingLine": "string — the exact first thing the session moderator says to begin",
  "closingCondition": "string — how the session knows when to end"
}

Rules:
- sessionPlan.questions: minimum 6, maximum 10
- First question must be a warm-up (lower stakes, rapport-building)
- Question 2 or 3 must directly target the user's stated weakness
- At least one question must be a curveball (unexpected, off-script)
- Last question should leave the user feeling tested but capable
- personas must have exactly 3 entries
- orbIndex: 0, 1, 2 for the 3 personas
- Colors for personas: use #7B6CFF, #F5A623, #6ee7b7 in that order
- voiceId must be a real ElevenLabs voice ID from this map: ${JSON.stringify(VOICE_IDS)}
- Map the VoiceDesigner's elevenLabsVoiceTarget name to the ID above
- Do not include any text outside the JSON object. No preamble, no explanation.`;

export async function runArchitect({ situation, researcherOutput, profilerOutput, weakSpotOutput, voiceDesignerOutput, styleHint }, writeChunk) {
  writeChunk({ agent: "Architect", chunk: "Architecting your personalised session plan…", thinking: true });

  // Compress inputs to stay within Groq 6000 TPM — only pass fields Architect actually needs
  const compressedInputs = {
    researcher: {
      interviewerPatterns: researcherOutput.interviewerPatterns,
      successPatterns: researcherOutput.successPatterns,
      redFlags: researcherOutput.redFlags,
      trendingTopics: researcherOutput.trendingTopics,
      keyFindings: (researcherOutput.keyFindings || []).slice(0, 3).map(f => f.insight),
    },
    profiler: {
      personaType: profilerOutput.personaType,
      interviewerPersonas: profilerOutput.interviewerPersonas,
      pushbackStyle: profilerOutput.pushbackStyle,
    },
    weakSpot: {
      diagnosedWeakness: weakSpotOutput.diagnosedWeakness,
      failureMechanism: weakSpotOutput.failureMechanism,
      responseFrameworks: (weakSpotOutput.responseFrameworks || []).map(f => ({ name: f.name, template: f.template })),
      warningSignals: weakSpotOutput.warningSignals,
      recoveryMove: weakSpotOutput.recoveryMove,
    },
    voiceDesigner: {
      voiceSpecs: (voiceDesignerOutput.voiceSpecs || []).map(v => ({
        personaName: v.personaName,
        elevenLabsVoiceTarget: v.voiceProfile?.elevenLabsVoiceTarget,
      })),
    },
  };

  const userPrompt = `The user's situation: "${situation}"

${JSON.stringify(compressedInputs)}
${styleHint ? `\n${styleHint}` : ""}

Design the optimal session plan. Make questions specific to the research. Map each elevenLabsVoiceTarget to a real voice ID from the VOICE_IDS map in the rules.`;

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
  const FALLBACK_SESSION = {
    agent: "Architect",
    sessionSummary: `A practice session for: ${situation}`,
    personas: fallbackPersonas,
    sessionPlan: {
      difficultyProgression: "escalating",
      totalEstimatedMinutes: 5,
      questions: [
        { text: `Tell me what's driving you to prepare for this — what's at stake for you?`, assignedPersona: fallbackPersonas[1].name, intent: "Warm-up — understand motivation.", followUpTriggers: [], curveballAfter: false, suggestedFollowUp: "What happens if this doesn't go well?" },
        { text: `Walk me through the specific part of this situation you're most anxious about.`, assignedPersona: fallbackPersonas[0].name, intent: "Surface the stated weakness.", followUpTriggers: ["vague"], curveballAfter: false, suggestedFollowUp: "Can you give me a concrete example of when that happened?" },
        { text: `What's the strongest argument against your position here?`, assignedPersona: fallbackPersonas[0].name, intent: "Test self-awareness and intellectual honesty.", followUpTriggers: [], curveballAfter: false, suggestedFollowUp: "How would you respond to that?" },
        { text: `If I pushed back hard on what you just said, what's your response?`, assignedPersona: fallbackPersonas[2].name, intent: "Stress test conviction.", followUpTriggers: [], curveballAfter: true, suggestedFollowUp: "You're being too abstract — give me something real." },
        { text: `What do you want us to remember about you after this conversation ends?`, assignedPersona: fallbackPersonas[1].name, intent: "Closing self-advocacy.", followUpTriggers: [], curveballAfter: false, suggestedFollowUp: "Why should that matter to us?" },
      ],
    },
    openingLine: `Thanks for being here. Let's get into it.`,
    closingCondition: "After all topics are covered or user signals they are done.",
    _isFallback: true,
  };

  let raw;
  try {
    let isFirst = true;
    raw = await callLLMStream({
      systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 2000,
      onChunk: (tok) => {
        writeChunk({ agent: "Architect", chunk: tok, streamStart: isFirst });
        isFirst = false;
      },
    });
  } catch (err) {
    console.error("[architect] LLM error:", err.message);
    writeChunk({ agent: "Architect", done: true, sessionData: FALLBACK_SESSION });
    return FALLBACK_SESSION;
  }

  let parsed = parseJSON(raw);

  // Fall back to default session if parse failed or personas are missing
  if (!parsed || !parsed.personas || parsed.personas.length !== 3) {
    console.error("[architect] bad output (personas:", parsed?.personas?.length, ") — using fallback session");
    writeChunk({ agent: "Architect", done: true, sessionData: FALLBACK_SESSION });
    return FALLBACK_SESSION;
  }

  // Ensure voiceIds are resolved correctly
  parsed.personas = parsed.personas.map((p) => ({
    ...p,
    voiceId: Object.values(VOICE_IDS).includes(p.voiceId) ? p.voiceId : resolveVoiceId(p.voiceId),
  }));

  writeChunk({ agent: "Architect", done: true, sessionData: parsed });

  return parsed;
}
