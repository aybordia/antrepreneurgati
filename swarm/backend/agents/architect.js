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

  let isFirst = true;
  const raw = await callLLMStream({
    systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 4096,
    onChunk: (tok) => {
      writeChunk({ agent: "Architect", chunk: tok, streamStart: isFirst });
      isFirst = false;
    },
  });

  const parsed = parseJSON(raw);

  // Validate persona count
  if (!parsed.personas || parsed.personas.length !== 3) {
    throw new Error(`Architect returned ${parsed.personas?.length} personas, expected 3`);
  }

  // Ensure voiceIds are resolved correctly
  parsed.personas = parsed.personas.map((p) => ({
    ...p,
    voiceId: Object.values(VOICE_IDS).includes(p.voiceId) ? p.voiceId : resolveVoiceId(p.voiceId),
  }));

  writeChunk({ agent: "Architect", done: true, sessionData: parsed });

  return parsed;
}
