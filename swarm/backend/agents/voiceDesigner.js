// PROMPT VERSION: 1.0
import { callLLMStream, parseJSON } from "../lib/llm.js";

const SYSTEM_PROMPT = `You are the Voice Designer agent in a multi-agent AI system called Swarm.

Your job: Design the exact voice and delivery characteristics for each agent persona that will speak to the user during their live practice session. Your output directly configures how each ElevenLabs voice is selected and calibrated.

You must match voices to archetypes derived from the Profiler's analysis. The voices must feel like real, distinct people — not AI characters.

Output format: Return ONLY a valid JSON object with this exact schema:
{
  "agent": "VoiceDesigner",
  "voiceSpecs": [
    {
      "personaArchetype": "string — matches Profiler's interviewerPersonas[].archetype",
      "personaName": "string — matches Profiler's interviewerPersonas[].name",
      "voiceProfile": {
        "gender": "male or female or neutral",
        "ageRange": "string — e.g. '40s-50s', '30s'",
        "pace": "slow or measured or moderate or brisk",
        "warmth": "cold or cool or neutral or warm or very_warm",
        "accentDirection": "string — e.g. 'American neutral', 'mild New England', 'British RP', 'no accent'",
        "vocabularyRegister": "technical or academic or conversational or executive",
        "signatureHabit": "string — one behavioral tell, e.g. 'Uses silence after every hard question'",
        "elevenLabsVoiceTarget": "string — must be exactly one of: Rachel, Arnold, Josh, Gigi, Adam",
        "stability": 0.6,
        "similarityBoost": 0.75
      }
    }
  ],
  "sessionPacingNotes": "string — how the session as a whole should feel in terms of rhythm and energy",
  "silenceGuidance": "string — how silence should be used across the session"
}

Rules:
- voiceSpecs must have exactly 3 entries matching the 3 Profiler personas
- stability: 0.0–1.0. Higher = more consistent. Use 0.3–0.5 for dynamic personas, 0.6–0.8 for formal ones.
- similarityBoost: 0.7–0.85 for most cases.
- elevenLabsVoiceTarget: must be exactly one of: Rachel, Arnold, Josh, Gigi, Adam
- The three voices must differ on at least 3 of the profile dimensions — no two voices should feel alike
- Do not include any text outside the JSON object. No preamble, no explanation.`;

export async function runVoiceDesigner({ situation, profilerOutput }, writeChunk) {
  writeChunk({ agent: "VoiceDesigner", chunk: "Designing voice profiles for each interviewer persona…", thinking: true });

  const userPrompt = `The user's situation: "${situation}"

The Profiler has identified these three interviewer archetypes:
${JSON.stringify(profilerOutput.interviewerPersonas)}

Design the voice specifications for each persona. The voices must feel like genuinely different people — different age, different energy, different pacing. Someone listening blindfolded should be able to tell immediately when the persona changes.`;

  const FALLBACK = {
    agent: "VoiceDesigner",
    voiceSpecs: [
      { personaArchetype: "The Skeptic",     personaName: "Alex",   voiceProfile: { gender: "male",   ageRange: "40s-50s", pace: "measured", warmth: "cool",   accentDirection: "American neutral", vocabularyRegister: "executive",      signatureHabit: "Uses silence after hard questions", elevenLabsVoiceTarget: "Arnold", stability: 0.7, similarityBoost: 0.75 } },
      { personaArchetype: "The Warm Mentor", personaName: "Jordan", voiceProfile: { gender: "female", ageRange: "30s",     pace: "moderate", warmth: "warm",   accentDirection: "American neutral", vocabularyRegister: "conversational",  signatureHabit: "Summarizes before challenging",     elevenLabsVoiceTarget: "Rachel", stability: 0.6, similarityBoost: 0.80 } },
      { personaArchetype: "The Stress Tester",personaName: "Morgan",voiceProfile: { gender: "male",   ageRange: "30s-40s", pace: "brisk",    warmth: "cold",   accentDirection: "American neutral", vocabularyRegister: "technical",       signatureHabit: "Asks rapid follow-ups",              elevenLabsVoiceTarget: "Josh",   stability: 0.4, similarityBoost: 0.75 } },
    ],
    sessionPacingNotes: "Moderate rhythm, escalating difficulty.",
    silenceGuidance: "Use silence after difficult questions to add pressure.",
  };

  let raw;
  try {
    let isFirst = true;
    raw = await callLLMStream({
      systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 1000,
      onChunk: (tok) => {
        writeChunk({ agent: "VoiceDesigner", chunk: tok, streamStart: isFirst });
        isFirst = false;
      },
    });
  } catch (err) {
    console.error("[voiceDesigner] LLM error:", err.message);
    writeChunk({ agent: "VoiceDesigner", done: true });
    return FALLBACK;
  }

  writeChunk({ agent: "VoiceDesigner", done: true });

  return parseJSON(raw) ?? FALLBACK;
}
