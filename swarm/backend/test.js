import dotenv from "dotenv";
dotenv.config();

import { runResearcher } from "./agents/researcher.js";
import { runProfiler } from "./agents/profiler.js";
import { runWeakSpotFinder } from "./agents/weakSpotFinder.js";

const situation = "MIT CS interview in 2 days — I always freeze on why MIT";
const noop = () => {};

console.log("Testing Researcher...");
try {
  const r = await runResearcher({ situation }, noop);
  console.log("✓ Researcher OK — keyFindings count:", r.keyFindings?.length);
} catch (e) {
  console.error("✗ Researcher FAILED:", e.message);
}

console.log("\nTesting Profiler...");
try {
  const p = await runProfiler({ situation }, noop);
  console.log("✓ Profiler OK — personas count:", p.interviewerPersonas?.length);
} catch (e) {
  console.error("✗ Profiler FAILED:", e.message);
}

console.log("\nTesting WeakSpotFinder...");
try {
  const w = await runWeakSpotFinder({ situation }, noop);
  console.log("✓ WeakSpotFinder OK — frameworks count:", w.responseFrameworks?.length);
} catch (e) {
  console.error("✗ WeakSpotFinder FAILED:", e.message);
}
