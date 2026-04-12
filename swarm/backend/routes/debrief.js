import { callLLM, parseJSON } from "../lib/llm.js";

const SYSTEM_PROMPT = `Analyze this interview session. Return ONLY valid JSON, no markdown:
{"clarityScore":<0-100>,"clarityRationale":"1 sentence why","bestMoment":{"quote":"verbatim from transcript","reason":"1 sentence"},"worstMoment":{"quote":"verbatim from transcript","reason":"1 sentence"},"contentGaps":[{"gap":"topic missed","suggestion":"what to say"}],"overallVerdict":"2 sentences honest feedback","priorityFix":"single most important fix"}

Scoring: 90-100=specific+evidence-backed, 75-89=mostly strong, 60-74=some weakness, 45-59=struggled, <45=fundamental issue. JSON only.`;

export default async function handler(req, res) {
  const { fullTranscript, situation } = req.body;

  // Only send last 12 turns to keep input tokens minimal
  const recentTranscript = (fullTranscript || []).slice(-12);
  const userTurns = recentTranscript.filter(t => t.speaker === "You" || t.speaker === "User");

  // Compute fallback score from word count
  const avgWords = userTurns.length
    ? Math.round(userTurns.reduce((s, t) => s + (t.text || "").split(/\s+/).filter(Boolean).length, 0) / userTurns.length)
    : 0;
  const computedScore = Math.min(95, Math.max(40, 50 + Math.min(avgWords, 45)));

  try {
    const userPrompt = `Situation: "${situation}"
Transcript:
${recentTranscript.map(t => `${t.speaker}: ${t.text}`).join("\n")}
Output JSON now.`;

    const raw = await callLLM({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 300 });
    const result = parseJSON(raw);

    if (!result?.clarityScore) {
      return res.json(fallback(computedScore));
    }

    // Ensure all required fields exist
    result.confidenceMap = result.confidenceMap || {};
    result.patterns = result.patterns || [];
    result.contentGaps = Array.isArray(result.contentGaps) ? result.contentGaps.slice(0, 2) : [];
    res.json(result);

  } catch (err) {
    console.error("debrief error:", err);
    res.json(fallback(computedScore));
  }
}

function fallback(score) {
  return {
    clarityScore: score,
    clarityRationale: "Score estimated from response length — full analysis temporarily unavailable.",
    confidenceMap: {},
    contentGaps: [],
    bestMoment: { quote: "", reason: "Retry in 30 seconds for full analysis." },
    worstMoment: { quote: "", reason: "Retry in 30 seconds for full analysis." },
    patterns: [],
    overallVerdict: "The AI debrief service is temporarily rate-limited. Click Get Debrief again in 30 seconds.",
    priorityFix: "Retry the debrief in 30 seconds for your full personalized analysis.",
  };
}
