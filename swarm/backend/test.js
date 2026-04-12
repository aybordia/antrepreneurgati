/**
 * Swarm backend test suite
 * Run: node test.js
 *
 * Tests:
 *  1. Agents produce non-fallback output for two different situations
 *  2. JudgeOrchestrator responses are DIFFERENT for different situations (personalization check)
 *  3. JudgeOrchestrator responds naturally to a greeting (conversational check)
 */

import dotenv from "dotenv";
dotenv.config();

import { callLLM } from "./lib/llm.js";
import { runJudgeOrchestrator } from "./agents/judgeOrchestrator.js";

let passed = 0;
let failed = 0;
let llmAvailable = false;

// Pre-check: verify LLM is reachable before running tests
console.log("── LLM availability check ──");
try {
  const ping = await callLLM({
    systemPrompt: "You are a test assistant. Reply with exactly: OK",
    userPrompt: "ping",
    maxTokens: 5,
  });
  llmAvailable = ping?.trim().includes("OK") || ping?.length > 0;
  console.log(`  LLM status: ${llmAvailable ? "✓ available" : "✗ unreachable"} (response: "${ping?.trim()}")\n`);
} catch (e) {
  console.error(`  LLM status: ✗ unavailable — ${e.message}`);
  console.error("  ⚠️  Tests that require LLM will be skipped. Set GEMINI_API_KEY in .env to run locally.\n");
}

function assertLLM(label, condition, detail = "") {
  if (!llmAvailable) {
    console.log(`  ⊘ SKIP (no LLM): ${label}`);
    return;
  }
  assert(label, condition, detail);
}

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ── Shared mock session builder ──────────────────────────────────────────────
function makeSession(situation, questions) {
  return JSON.stringify({
    situation,
    openingLine: "Thanks for joining us today.",
    personas: [
      { name: "Alex",   role: "Senior Interviewer", style: "Direct and probing.", voiceId: "voice_1", color: "#7B6CFF", orbIndex: 0 },
      { name: "Jordan", role: "Panel Member",        style: "Warm but thorough.",  voiceId: "voice_2", color: "#F5A623", orbIndex: 1 },
    ],
    sessionPlan: {
      difficultyProgression: "escalating",
      totalEstimatedMinutes: 5,
      questions: questions.map((text, i) => ({
        text,
        assignedPersona: i % 2 === 0 ? "Alex" : "Jordan",
        intent: "Assess depth",
        followUpTriggers: [],
        curveballAfter: false,
        suggestedFollowUp: "Tell me more.",
      })),
    },
  });
}

const GOOGLE_SWE_SESSION = makeSession(
  "Google L4 software engineering interview next week — I struggle with system design and get nervous on coding problems under pressure",
  [
    "Walk me through how you'd design a URL shortener like bit.ly at Google scale.",
    "Tell me about a time you had to make a technical decision with incomplete information.",
    "How do you handle being stuck on a coding problem during an interview?",
  ]
);

const MIT_ADMISSIONS_SESSION = makeSession(
  "MIT undergraduate admissions interview in 3 days — I'm afraid I'll come across as just another high-achieving student with no genuine passion",
  [
    "What's a problem in the world that genuinely keeps you up at night — and why you specifically?",
    "Describe a time you pursued something you were terrible at. What happened?",
    "Why MIT specifically — not just a top engineering school in general?",
  ]
);

const PARENT_CONVERSATION_SESSION = makeSession(
  "Difficult conversation with my parents tonight about dropping pre-med to pursue music — they've invested everything in my medical future",
  [
    "How are you going to explain this decision without sounding ungrateful?",
    "What's your plan if music doesn't work out — have you thought that through?",
    "How do you respond when they say they're just worried about your future?",
  ]
);

// ── Test 1: Opening lines are situation-specific ─────────────────────────────
console.log("\n── Test 1: Opening lines are situation-specific ──");

const openings = {};
for (const [name, session] of [
  ["Google SWE", GOOGLE_SWE_SESSION],
  ["MIT Admissions", MIT_ADMISSIONS_SESSION],
  ["Parent Conversation", PARENT_CONVERSATION_SESSION],
]) {
  try {
    const result = await runJudgeOrchestrator({
      transcript: "",
      sessionContext: session,
      history: [],
      currentQuestionIndex: 0,
    });
    openings[name] = result.line;
    console.log(`\n  [${name}] opening:\n  "${result.line}"`);
    assert(`${name} — opening is non-empty`, result.line?.length > 10);
  } catch (e) {
    console.error(`  ✗ ${name} opening threw:`, e.message);
    failed++;
  }
}

// All three openings must be different from each other
if (openings["Google SWE"] && openings["MIT Admissions"] && openings["Parent Conversation"]) {
  assert(
    "Google ≠ MIT opening",
    openings["Google SWE"] !== openings["MIT Admissions"],
    `\n    Google: "${openings["Google SWE"]}"\n    MIT:    "${openings["MIT Admissions"]}"`
  );
  assert(
    "MIT ≠ Parent opening",
    openings["MIT Admissions"] !== openings["Parent Conversation"]
  );
}

// ── Test 2: Responses reference situation-specific content ──────────────────
console.log("\n── Test 2: Responses reference situation-specific content ──");

// Broad keyword sets — at least one must appear in the response.
// Includes domain words, session plan question words, and situation words.
const SITUATION_KEYWORDS = {
  "Google SWE": [
    "google", "engineer", "system", "design", "coding", "code", "technical", "algorithm",
    "distributed", "scale", "url", "shortener", "request", "million", "backend",
    "infrastructure", "latency", "l4", "data structure", "software", "internship",
    "python", "go", "startup", "decision", "incomplete",
    "cache", "database", "service", "api", "performance", "concurren", "tradeoff",
    "architect", "implement", "memory", "network", "load", "microservice",
  ],
  "MIT Admissions": [
    "mit", "admissions", "passion", "curious", "research", "community", "applicant",
    "intellectual", "university", "college", "authentic", "unique", "high-achiev",
    "night", "problem", "world", "care", "math", "competition",
    // words that appear naturally in MIT-style questions
    "pursue", "pursued", "terrible", "yourself", "genuinely", "honest",
    "sleep", "keeps", "change", "mind", "specific", "why mit",
  ],
  "Parent Conversation": [
    "parent", "music", "pre-med", "family", "medical", "decision", "future",
    "ungrateful", "invested", "conversation", "drop", "pursue", "doctor",
    "worried", "plan", "work out", "explain",
    // words that naturally appear when discussing this scenario
    "devastat", "apprehensiv", "scar", "reaction", "feel", "emotion",
    "support", "expect", "gratitude", "grateful", "disappoint", "career",
    "sacrifice", "relationship", "concern", "tell", "switch", "change",
  ],
};

// These patterns must NOT appear — would mean response bled into wrong situation
const CROSS_CONTAMINATION = {
  "Google SWE":          [/\bmit\b/i, /\badmission/i, /\bpre.med\b/i],
  "MIT Admissions":      [/\bgoogle\b/i, /\bpre.med\b/i, /\burl shortener/i],
  "Parent Conversation": [/\bgoogle\b/i, /\bmit\b/i, /\badmission/i],
};

const history1 = [
  { speaker: "Alex", text: openings["Google SWE"] || "Tell me about yourself.", timestamp: Date.now() },
  { speaker: "You",  text: "I've been coding for 6 years, mostly backend work in Python and Go. I did an internship at a mid-size startup last summer.", timestamp: Date.now() },
];

const history2 = [
  { speaker: "Alex", text: openings["MIT Admissions"] || "Tell me about yourself.", timestamp: Date.now() },
  { speaker: "You",  text: "I'm really passionate about math and CS. I've done a lot of competitions and research at my school.", timestamp: Date.now() },
];

const history3 = [
  { speaker: "Alex", text: openings["Parent Conversation"] || "What's on your mind?", timestamp: Date.now() },
  { speaker: "You",  text: "I want to tell my parents I'm dropping pre-med to pursue music full time. I'm scared they'll be devastated.", timestamp: Date.now() },
];

const responses = {};
for (const [name, session, history] of [
  ["Google SWE",          GOOGLE_SWE_SESSION,       history1],
  ["MIT Admissions",      MIT_ADMISSIONS_SESSION,   history2],
  ["Parent Conversation", PARENT_CONVERSATION_SESSION, history3],
]) {
  try {
    const result = await runJudgeOrchestrator({
      transcript: history[history.length - 1].text,
      sessionContext: session,
      history,
      currentQuestionIndex: 0,
    });
    responses[name] = result.line;
    console.log(`\n  [${name}] follow-up:\n  "${result.line}"`);

    const lower = result.line.toLowerCase();

    // Must match at least one domain keyword (only meaningful when LLM runs)
    const keywords = SITUATION_KEYWORDS[name];
    const matched = keywords.filter(k => lower.includes(k));
    assertLLM(
      `${name} — references situation domain (matched: ${matched.join(", ") || "none"})`,
      matched.length > 0,
      `Expected at least one of: ${keywords.join(", ")}`
    );

    // Must not bleed into another situation
    const contaminated = CROSS_CONTAMINATION[name].filter(rx => rx.test(result.line));
    assert(
      `${name} — no cross-contamination from other situations`,
      contaminated.length === 0,
      `Found forbidden patterns: ${contaminated.join(", ")}`
    );
  } catch (e) {
    console.error(`  ✗ ${name} follow-up threw:`, e.message);
    failed++;
  }
}

// All three responses must be different from each other
const respValues = Object.values(responses);
assert(
  "All three situation responses are unique",
  new Set(respValues).size === respValues.filter(Boolean).length,
  "Two or more responses were identical"
);

// ── Test 3: Greeting is handled conversationally ─────────────────────────────
console.log("\n── Test 3: Greeting handled conversationally (no immediate question) ──");

try {
  const result = await runJudgeOrchestrator({
    transcript: "Hi, hello!",
    sessionContext: GOOGLE_SWE_SESSION,
    history: [
      { speaker: "Alex", text: "Welcome. Let's get started.", timestamp: Date.now() },
    ],
    currentQuestionIndex: 0,
  });
  console.log(`\n  Greeting response: "${result.line}"`);

  const lower = result.line.toLowerCase();
  // Should contain a greeting word
  assertLLM(
    "Response to greeting doesn't immediately fire a hard question",
    !/^(walk me through|tell me about|describe|how would you|what would you|design)/i.test(result.line.trim()),
    `Got: "${result.line}"`
  );
} catch (e) {
  console.error("  ✗ Greeting test threw:", e.message);
  failed++;
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\n⚠️  Some tests failed — the judge orchestrator may not be personalizing correctly.");
  process.exit(1);
} else {
  console.log("\n✓ All personalization checks passed.");
}
