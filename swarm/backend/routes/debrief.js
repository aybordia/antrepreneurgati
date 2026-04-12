// Instant debrief — pure JS analysis, zero LLM calls, zero latency

export default async function handler(req, res) {
  const { fullTranscript = [], situation = "" } = req.body;

  const userTurns = fullTranscript.filter(t => t.speaker === "You" || t.speaker === "User");
  const aiTurns   = fullTranscript.filter(t => t.speaker !== "You" && t.speaker !== "User");

  if (userTurns.length === 0) {
    return res.json(emptyFallback());
  }

  // ── Word counts per turn ──────────────────────────────────────────────────
  const wordCounts = userTurns.map(t => (t.text || "").split(/\s+/).filter(Boolean).length);
  const avgWords   = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);
  const minWords   = Math.min(...wordCounts);
  const maxWords   = Math.max(...wordCounts);

  // ── Filler word detection ─────────────────────────────────────────────────
  const allUserText = userTurns.map(t => t.text || "").join(" ").toLowerCase();
  const fillerWords = ["um", "uh", "like", "you know", "basically", "literally", "kind of", "sort of"];
  const fillerCount = fillerWords.reduce((n, f) => n + (allUserText.match(new RegExp(`\\b${f}\\b`, "g")) || []).length, 0);
  const fillerRate  = fillerCount / userTurns.length; // fillers per turn

  // ── Score computation ─────────────────────────────────────────────────────
  // Base: avg words (longer = more substantive), cap at 45 words
  let score = 50 + Math.min(avgWords, 45);
  // Penalise very short answers
  if (minWords < 10) score -= 12;
  else if (minWords < 20) score -= 5;
  // Penalise filler words
  if (fillerRate > 3) score -= 10;
  else if (fillerRate > 1.5) score -= 5;
  // Bonus for consistency (max not massively higher than min)
  if (maxWords / Math.max(minWords, 1) < 3) score += 5;
  const clarityScore = Math.min(95, Math.max(35, Math.round(score)));

  // ── Best / worst moment ───────────────────────────────────────────────────
  const ranked = [...userTurns].sort((a, b) =>
    (b.text || "").split(/\s+/).length - (a.text || "").split(/\s+/).length
  );
  const bestTurn  = ranked[0];
  const worstTurn = ranked[ranked.length - 1];

  const bestQuote  = (bestTurn?.text  || "").slice(0, 120);
  const worstQuote = (worstTurn?.text || "").slice(0, 120);

  // ── Rationale ─────────────────────────────────────────────────────────────
  let rationale = "";
  if (clarityScore >= 80)      rationale = `Strong, detailed responses averaging ${avgWords} words. You stayed specific and substantive throughout.`;
  else if (clarityScore >= 65) rationale = `Solid overall with some answers averaging ${avgWords} words, though a few responses were too brief to be convincing.`;
  else if (clarityScore >= 50) rationale = `Mixed performance — averaging ${avgWords} words per answer. Several responses were too short and lacked supporting detail.`;
  else                         rationale = `Responses averaged only ${avgWords} words. Most answers needed significantly more depth and specific examples.`;

  if (fillerRate > 1.5) rationale += ` Filler words detected (${fillerCount} total) — reducing these will improve perceived confidence.`;

  // ── Verdict ───────────────────────────────────────────────────────────────
  let verdict = "";
  if (clarityScore >= 80) {
    verdict = `You demonstrated strong communication in this session for "${situation}". Your answers were substantive and well-developed. Focus on eliminating any remaining hedging language to come across as fully confident.`;
  } else if (clarityScore >= 65) {
    verdict = `Solid session for "${situation}" with clear room to improve. Your stronger answers showed what you're capable of — the weaker ones dragged the average down. Work on bringing that same depth to every response.`;
  } else if (clarityScore >= 50) {
    verdict = `This session for "${situation}" revealed a pattern of under-developed answers. You have the right instincts but consistently stop short of providing the specific evidence or examples that make answers compelling.`;
  } else {
    verdict = `This session exposed a fundamental gap between what you know and how you're communicating it. For "${situation}", you need to practice structuring answers with a clear point, supporting evidence, and a confident close.`;
  }

  // ── Priority fix ──────────────────────────────────────────────────────────
  let priorityFix = "";
  if (minWords < 15)        priorityFix = "Never give a one-line answer — even a simple question deserves a point, an example, and a close.";
  else if (fillerRate > 2)  priorityFix = `Cut filler words (detected ${fillerCount}) — replace "um/uh/like" with a deliberate pause.`;
  else if (avgWords < 35)   priorityFix = "Double the length of every answer by adding one specific example or data point.";
  else                      priorityFix = "Push for more specificity — name exact projects, numbers, or outcomes instead of speaking in generalities.";

  return res.json({
    clarityScore,
    clarityRationale: rationale,
    confidenceMap: {},
    contentGaps: [],
    bestMoment: {
      quote: bestQuote,
      reason: `Your most developed answer at ${(bestTurn?.text || "").split(/\s+/).length} words — this level of detail is what strong answers look like.`,
    },
    worstMoment: {
      quote: worstQuote,
      reason: `Your shortest response at ${(worstTurn?.text || "").split(/\s+/).length} words — this needed significantly more depth and a concrete example.`,
    },
    patterns: fillerRate > 1 ? [`${fillerCount} filler words detected across the session`] : [],
    overallVerdict: verdict,
    priorityFix,
  });
}

function emptyFallback() {
  return {
    clarityScore: 50,
    clarityRationale: "No transcript data found for this session.",
    confidenceMap: {}, contentGaps: [],
    bestMoment: { quote: "", reason: "" },
    worstMoment: { quote: "", reason: "" },
    patterns: [],
    overallVerdict: "Session data was not available for analysis.",
    priorityFix: "Complete a full session to receive your debrief.",
  };
}
