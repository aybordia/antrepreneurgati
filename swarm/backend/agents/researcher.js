// PROMPT VERSION: 2.0 — instant, no LLM call, never hangs
import { tavilySearch, formatResults } from "../lib/tavily.js";

export async function runResearcher({ situation }, writeChunk) {
  writeChunk({ agent: "Researcher", chunk: "Searching for real interview reports and patterns…", thinking: true });

  // Try Tavily — if it fails or times out, use empty context (judge is fully generative)
  let interviewerPatterns = "";
  let keyFindings = [];

  try {
    const results = await tavilySearch({ query: situation + " interview tips preparation", maxResults: 2 });
    if (results.length > 0) {
      interviewerPatterns = results.map(r => r.snippet).join(" ").slice(0, 200);
      keyFindings = results.map(r => ({ insight: r.snippet.slice(0, 100), source: r.url }));
    }
  } catch (err) {
    console.log("[researcher] Tavily skipped:", err.message);
  }

  writeChunk({ agent: "Researcher", chunk: interviewerPatterns || `Research complete for: ${situation.slice(0, 60)}`, streamStart: true });
  writeChunk({ agent: "Researcher", done: true });

  return {
    agent: "Researcher",
    keyFindings,
    interviewerPatterns,
    successPatterns: "",
    redFlags: [],
    trendingTopics: [],
    rawSummary: interviewerPatterns || situation,
  };
}
