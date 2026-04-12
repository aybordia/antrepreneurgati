// PROMPT VERSION: 1.0
import { callLLM, parseJSON } from "../lib/llm.js";

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
  const userPrompt = `The user's situation: "${situation}"

The Profiler has identified these three interviewer archetypes:
${JSON.stringify(profilerOutput.interviewerPersonas, null, 2)}

Design the voice specifications for each persona. The voices must feel like genuinely different people — different age, different energy, different pacing. Someone listening blindfolded should be able to tell immediately when the persona changes.`;

  const raw = await callLLM({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 1000 });

  for (const char of raw) {
    writeChunk({ agent: "VoiceDesigner", chunk: char, done: false });
  }
  writeChunk({ agent: "VoiceDesigner", chunk: "", done: true });

  return parseJSON(raw);
}
