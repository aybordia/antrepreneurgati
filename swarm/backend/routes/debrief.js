import { callLLM, parseJSON } from "../lib/llm.js";
import { getPrefs, buildDebriefStyleHint } from "../lib/prefsStore.js";

const SYSTEM_PROMPT = `You are the Debrief Analyzer in Swarm. You run after the user completes their practice session.

Your job: Analyze the complete session transcript and produce a structured, honest, specific debrief. You are a world-class communication coach who has reviewed thousands of practice sessions. You do not soften feedback. You identify both genuine strengths and genuine weaknesses with surgical precision.

Output format: Return ONLY a valid JSON object with this exact schema:
{
  "clarityScore": 72,
  "clarityRationale": "string — 2-3 sentences explaining exactly why this score",
  "confidenceMap": {
    "<question_text>": {
      "score": 70,
      "notes": "string — 1-2 sentences on what worked or failed"
    }
  },
  "contentGaps": [
    {
      "gap": "string — specific topic the research said would matter that the user did not mention",
      "importance": "high or medium or low",
      "suggestion": "string — what they should have said"
    }
  ],
  "bestMoment": {
    "quote": "string — verbatim excerpt from transcript, max 2 sentences",
    "reason": "string — exactly why this moment worked"
  },
  "worstMoment": {
    "quote": "string — verbatim excerpt from transcript, max 2 sentences",
    "reason": "string — exactly why this moment failed"
  },
  "patterns": [],
  "overallVerdict": "string — 3-4 sentences. Honest, specific. Does not end with generic encouragement.",
  "priorityFix": "string — the ONE thing that if fixed would have the biggest impact"
}

Scoring rubric:
90-100: Every answer specific, evidence-backed, no filler, strong close
75-89: Most answers strong, minor vagueness in 1-2 spots
60-74: Some strong moments but recurring weakness, noticeable stumble on key question
45-59: Multiple weak answers, frequent filler, struggled under pushback
Below 45: Fundamental issue with delivery or content

Rules:
- confidenceMap key must use the exact question text from sessionPlan
- bestMoment.quote and worstMoment.quote must be verbatim from the transcript
- Do not include any text outside the JSON object. No preamble, no explanation.`;

export default async function handler(req, res) {
  const { fullTranscript, situation, agentResearch, sessionPlan } = req.body;

  // Load user debrief style preference
  const userPrefs = req.userId ? getPrefs(req.userId) : null;
  const debriefHint = buildDebriefStyleHint(userPrefs);

  try {
    const userPrompt = `ORIGINAL SITUATION:
"${situation}"

RESEARCH CONTEXT:
Researcher findings: ${JSON.stringify(agentResearch?.Researcher?.keyFindings || [], null, 2)}
Weak spots identified: ${JSON.stringify(agentResearch?.WeakSpotFinder || {}, null, 2)}

SESSION PLAN:
${JSON.stringify(sessionPlan?.questions?.map((q) => q.text) || [])}

COMPLETE SESSION TRANSCRIPT:
${fullTranscript.map((t) => `[${t.speaker}]: ${t.text}`).join("\n")}

Analyze this session and produce your Debrief Analyzer output JSON. Be honest. Be specific. Quote the transcript directly for best/worst moments.
${debriefHint ? `\n${debriefHint}` : ""}`;

    const raw = await callLLM({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 2000 });
    const result = parseJSON(raw);

    res.json(result);
  } catch (err) {
    console.error("debrief error:", err);
    res.status(500).json({ error: err.message });
  }
}
