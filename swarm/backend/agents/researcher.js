// PROMPT VERSION: 1.0
import { callLLMStream, parseJSON } from "../lib/llm.js";
import { tavilySearch, formatResults } from "../lib/tavily.js";

const SYSTEM_PROMPT = `You are the Researcher agent in a multi-agent AI interview preparation system called Swarm.

Your job: Given a user's specific situation, search for and synthesize real, current, specific information about the type of conversation they are preparing for. You will receive pre-formatted search results from Tavily Search. Your job is to extract the most actionable, specific, and recent insights from those results.

Output format: Return ONLY a valid JSON object with this exact schema:
{
  "agent": "Researcher",
  "keyFindings": [
    {
      "insight": "string — one specific, actionable finding",
      "source": "string — where this came from (publication, subreddit, etc.)",
      "recency": "string — approximate date or year if known",
      "relevance": "string — why this matters for the user's specific situation"
    }
  ],
  "interviewerPatterns": "string — 2-3 sentences describing patterns seen across multiple sources about how interviewers in this context behave",
  "successPatterns": "string — 2-3 sentences describing what candidates who succeed in this context do differently",
  "redFlags": ["string", "string", "string"],
  "trendingTopics": ["string", "string"],
  "rawSummary": "string — 100-150 word plain-English summary of everything found, written as briefing for the user"
}

Quality rules:
- Every insight must be specific. "MIT interviewers value intellectual curiosity" is too generic. "Multiple 2025 MIT interview reports on r/MITAdmissions describe interviewers asking candidates to walk through a time they changed their mind on a technical belief — not just a fact — suggesting they're probing for epistemic humility" is specific.
- If search results are sparse or irrelevant, say so explicitly in rawSummary. Do not fabricate sources.
- Minimum 5 keyFindings. Maximum 8.
- Do not include any text outside the JSON object. No preamble, no explanation, no markdown.`;

export async function runResearcher({ situation }, writeChunk) {
  writeChunk({ agent: "Researcher", chunk: "Searching for real interview reports and patterns…", thinking: true });

  // Build search query directly from situation (saves 1 LLM call)
  const searchQuery = situation + " Reddit OR forum OR firsthand experience";

  // Run Tavily search
  let formattedResults;
  try {
    console.log("[researcher] starting Tavily search...");
    const results = await tavilySearch({ query: searchQuery.trim(), maxResults: 3 });
    formattedResults = formatResults(results);
    console.log("[researcher] Tavily done, got", results.length, "results");
  } catch (err) {
    console.log("[researcher] Tavily failed/timed out:", err.message, "— using fallback");
    formattedResults = "[RESEARCH NOTE: Live search unavailable. Analysis based on training data as of 2024.]";
  }

  const extractedGap = situation.includes("—") ? situation.split("—")[1].trim() : situation;

  const userPrompt = `Here is the user's situation: "${situation}"

Here are the Tavily search results for their context:
${formattedResults}

Analyze these results and produce your Researcher output JSON. Focus on insights that are:
1. Specific to the type of conversation described (not generic interview advice)
2. Actionable (the user can do something with this information)
3. Relevant to the specific gap or fear the user mentioned

The user mentioned this specific gap or concern: "${extractedGap}"
Pay particular attention to any findings that address this gap.`;

  const FALLBACK = {
    agent: "Researcher", keyFindings: [],
    interviewerPatterns: "Research unavailable for this session.",
    successPatterns: "Research unavailable for this session.",
    redFlags: [], trendingTopics: [],
    rawSummary: "Live research was unavailable. Proceeding with general interview preparation.",
  };

  console.log("[researcher] calling LLM...");
  let raw;
  try {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000));
    raw = await Promise.race([
      callLLMStream({
        systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 500,
        onChunk: (tok) => { writeChunk({ agent: "Researcher", chunk: tok, streamStart: !raw }); },
      }),
      timeout,
    ]);
  } catch (err) {
    console.error("[researcher] LLM error/timeout:", err.message, "— using fallback");
    writeChunk({ agent: "Researcher", done: true });
    return FALLBACK;
  }

  writeChunk({ agent: "Researcher", done: true });
  return parseJSON(raw) ?? FALLBACK;
}
