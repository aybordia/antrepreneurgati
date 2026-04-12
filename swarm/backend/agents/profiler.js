// PROMPT VERSION: 1.0
import { callLLM, parseJSON } from "../lib/llm.js";

const SYSTEM_PROMPT = `You are the Profiler agent in a multi-agent AI system called Swarm.

Your job: Build a detailed psychological and behavioral profile of the type of person the user will be facing in their conversation — their interviewer, investor, negotiation partner, or debate opponent.

This profile is not generic. It must be derived from the specific type of conversation and context the user described. A Stanford admissions interviewer is not the same as an MIT one. A Sequoia VC is not the same as an angel investor. A FAANG engineering manager is not the same as a startup CTO. Your profile must reflect the actual differences.

Output format: Return ONLY a valid JSON object with this exact schema:
{
  "agent": "Profiler",
  "personaType": "string — short label for who this person is, e.g. 'Alumni Volunteer MIT Admissions Interviewer'",
  "demographics": "string — typical age range, background, how they got this role",
  "coreValues": ["string", "string", "string"],
  "communicationStyle": "string — how they typically speak, ask questions, respond",
  "leansIn": ["string", "string", "string"],
  "checksOut": ["string", "string", "string"],
  "silenceUsage": "string — how they use silence: weapon, tool, or filler",
  "pushbackStyle": "string — how they challenge candidates: direct, subtle, Socratic, aggressive",
  "redFlags": ["string", "string", "string"],
  "greenFlags": ["string", "string", "string"],
  "catchPhrasePatterns": ["string", "string"],
  "psychologicalProfile": "string — 2-3 sentences on what makes this type of person tick, what they're really evaluating for under the surface",
  "interviewerPersonas": [
    {
      "name": "string — invented but realistic name",
      "archetype": "string — e.g. 'The Skeptic', 'The Warm Mentor', 'The Stress Tester'",
      "shortBio": "string — 2 sentences on who this person is",
      "voiceDescription": "string — how they sound: pace, warmth, accent direction, vocabulary register"
    }
  ]
}

Rules:
- interviewerPersonas must have exactly 3 entries — these are the 3 distinct personality types the user might face
- voiceDescription must be specific enough to guide ElevenLabs voice selection. Include: pace (slow/medium/fast), warmth (cold/neutral/warm), vocabulary (simple/technical/academic), signature habit (uses silence, asks follow-ups, summarizes before challenging)
- Do not include any text outside the JSON object. No preamble, no explanation.`;

export async function runProfiler({ situation }, writeChunk) {
  const extractedGap = situation.includes("—") ? situation.split("—")[1].trim() : situation;

  const userPrompt = `The user's situation: "${situation}"

Build a Profiler output for the type of person or panel they will be facing. Be specific to this exact context — not generic interview advice.

If this is an academic interview: profile the specific institution's culture.
If this is a corporate interview: profile the specific company's known hiring philosophy.
If this is a pitch: profile the specific type of investor they'll face.
If it's a negotiation: profile the power dynamic and what the other party cares about.

The user's stated weakness or fear: "${extractedGap}"
This matters — the profiler should include how this type of interviewer specifically responds to candidates who exhibit this weakness.`;

  const raw = await callLLM({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 2048 });

  for (const char of raw) {
    writeChunk({ agent: "Profiler", chunk: char, done: false });
  }
  writeChunk({ agent: "Profiler", chunk: "", done: true });

  return parseJSON(raw);
}
