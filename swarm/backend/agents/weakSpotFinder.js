// PROMPT VERSION: 1.0
import { callLLMStream, parseJSON } from "../lib/llm.js";

const SYSTEM_PROMPT = `You are the Weak Spot Finder agent in a multi-agent AI system called Swarm.

Your job: Diagnose the specific weakness or fear the user described, explain exactly why it fails in their context, and build concrete counter-strategies and response frameworks they can use.

You are a ruthless diagnostician. You do not reassure. You identify the specific mechanism by which the weakness causes failure and you build surgical interventions.

Output format: Return ONLY a valid JSON object with this exact schema:
{
  "agent": "WeakSpotFinder",
  "diagnosedWeakness": "string — restate the weakness in more precise clinical terms",
  "rootCause": "string — why this specific weakness tends to occur in this type of person in this type of conversation",
  "failureMechanism": "string — exactly how this weakness manifests and why it causes the conversation to go wrong",
  "commonMistakes": ["string", "string", "string"],
  "responseFrameworks": [
    {
      "name": "string — short memorable name for this framework",
      "description": "string — 1 sentence on what this framework does",
      "template": "string — the actual response structure, e.g. 'Start with X, then pivot to Y, close with Z'",
      "example": "string — a sample sentence or two showing this framework in action for their specific situation"
    }
  ],
  "practicePrompts": ["string", "string", "string"],
  "warningSignals": ["string", "string"],
  "recoveryMove": "string — what to say or do when the user realizes mid-answer they've stumbled into the weakness"
}

Rules:
- responseFrameworks must have exactly 3 entries — distinct approaches, not variations on the same theme
- practicePrompts are specific questions the user should practice answering before their session
- warningSignals are in-the-moment cues the user can recognize that signal they're drifting into the weakness
- Do not include any text outside the JSON object. No preamble, no explanation.`;

export async function runWeakSpotFinder({ situation }, writeChunk) {
  writeChunk({ agent: "WeakSpotFinder", chunk: "Diagnosing your weak spots with surgical precision…", thinking: true });

  const extractedGap = situation.includes("—") ? situation.split("—")[1].trim() : situation;

  const userPrompt = `The user's situation: "${situation}"
The user's specific stated weakness or gap: "${extractedGap}"

Diagnose this weakness precisely and build surgical counter-strategies.

Do not give general interview advice. This is about their specific gap in their specific context. The responseFramework examples must reference their actual situation — not generic placeholders.`;

  const FALLBACK = {
    agent: "WeakSpotFinder", diagnosedWeakness: "Analysis unavailable.",
    rootCause: "", failureMechanism: "", commonMistakes: [],
    responseFrameworks: [
      { name: "Bridge", description: "Bridge to your strengths.", template: "Acknowledge, bridge, strength.", example: "" },
      { name: "STAR", description: "Situation-Task-Action-Result.", template: "State situation, task, action, result.", example: "" },
      { name: "Reframe", description: "Reframe the weakness.", template: "Acknowledge honestly, then show growth.", example: "" },
    ],
    practicePrompts: [], warningSignals: [], recoveryMove: "",
  };

  let raw;
  try {
    let isFirst = true;
    raw = await callLLMStream({
      systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 900,
      onChunk: (tok) => {
        writeChunk({ agent: "WeakSpotFinder", chunk: tok, streamStart: isFirst });
        isFirst = false;
      },
    });
  } catch (err) {
    console.error("[weakSpotFinder] LLM error:", err.message);
    writeChunk({ agent: "WeakSpotFinder", done: true });
    return FALLBACK;
  }

  writeChunk({ agent: "WeakSpotFinder", done: true });

  return parseJSON(raw) ?? FALLBACK;
}
