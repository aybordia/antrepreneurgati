// PROMPT VERSION: 1.0
import { callLLMStream, parseJSON } from "../lib/llm.js";

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
  writeChunk({ agent: "Profiler", chunk: "Building psychological profile of your interviewers…", thinking: true });

  const extractedGap = situation.includes("—") ? situation.split("—")[1].trim() : situation;

  const userPrompt = `The user's situation: "${situation}"

Build a Profiler output for the type of person or panel they will be facing. Be specific to this exact context — not generic interview advice.

If this is an academic interview: profile the specific institution's culture.
If this is a corporate interview: profile the specific company's known hiring philosophy.
If this is a pitch: profile the specific type of investor they'll face.
If it's a negotiation: profile the power dynamic and what the other party cares about.

The user's stated weakness or fear: "${extractedGap}"
This matters — the profiler should include how this type of interviewer specifically responds to candidates who exhibit this weakness.`;

  let raw;
  try {
    let isFirst = true;
    raw = await callLLMStream({
      systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 900,
      onChunk: (tok) => {
        writeChunk({ agent: "Profiler", chunk: tok, streamStart: isFirst });
        isFirst = false;
      },
    });
  } catch (err) {
    console.error("[profiler] LLM error:", err.message);
    writeChunk({ agent: "Profiler", done: true });
    return {
      agent: "Profiler", personaType: "Interviewer", demographics: "Unknown",
      coreValues: [], communicationStyle: "", leansIn: [], checksOut: [],
      silenceUsage: "", pushbackStyle: "", redFlags: [], greenFlags: [],
      catchPhrasePatterns: [], psychologicalProfile: "",
      interviewerPersonas: [
        { name: "Alex", archetype: "The Skeptic", shortBio: "Experienced evaluator.", voiceDescription: "Medium pace, neutral warmth, conversational." },
        { name: "Jordan", archetype: "The Warm Mentor", shortBio: "Supportive interviewer.", voiceDescription: "Slow pace, warm, academic." },
        { name: "Morgan", archetype: "The Stress Tester", shortBio: "Challenges every answer.", voiceDescription: "Fast pace, cold, technical." },
      ],
    };
  }

  writeChunk({ agent: "Profiler", done: true });

  const result = parseJSON(raw);
  if (!result) {
    return {
      agent: "Profiler", personaType: "Interviewer", demographics: "Unknown",
      coreValues: [], communicationStyle: "", leansIn: [], checksOut: [],
      silenceUsage: "", pushbackStyle: "", redFlags: [], greenFlags: [],
      catchPhrasePatterns: [], psychologicalProfile: "",
      interviewerPersonas: [
        { name: "Alex", archetype: "The Skeptic", shortBio: "Experienced evaluator.", voiceDescription: "Medium pace, neutral warmth, conversational." },
        { name: "Jordan", archetype: "The Warm Mentor", shortBio: "Supportive interviewer.", voiceDescription: "Slow pace, warm, academic." },
        { name: "Morgan", archetype: "The Stress Tester", shortBio: "Challenges every answer.", voiceDescription: "Fast pace, cold, technical." },
      ],
    };
  }
  return result;
}
