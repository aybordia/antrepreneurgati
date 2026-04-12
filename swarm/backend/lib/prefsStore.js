/**
 * prefsStore.js
 * Stores and retrieves per-user learned style preferences.
 * Separate from sessionStore (session history) — this persists long-term.
 *
 * Schema:
 * {
 *   userId, updatedAt, sessionCount,
 *   interview: { tone, detailLevel, positivePatterns[], negativePatterns[] },
 *   debrief:   { tone, detailLevel, positivePatterns[], negativePatterns[] },
 *   ratingHistory: [{ sessionId, interviewRating, debriefRating, ts }]
 * }
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREFS_DIR = path.join(__dirname, "../data/prefs");

function prefsFile(userId) {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(PREFS_DIR, `${safe}.json`);
}

const DEFAULT_PREFS = () => ({
  interview: {
    tone: "balanced",          // "direct" | "warm" | "balanced"
    detailLevel: "specific",   // "broad" | "specific"
    positivePatterns: [],      // what user said they liked
    negativePatterns: [],      // what user said they didn't like
  },
  debrief: {
    tone: "direct",            // "encouraging" | "direct" | "balanced"
    detailLevel: "balanced",   // "concise" | "balanced" | "detailed"
    positivePatterns: [],
    negativePatterns: [],
  },
  ratingHistory: [],
  sessionCount: 0,
  updatedAt: 0,
});

export function getPrefs(userId) {
  const file = prefsFile(userId);
  if (!fs.existsSync(file)) return DEFAULT_PREFS();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return DEFAULT_PREFS();
  }
}

export function savePrefs(userId, prefs) {
  fs.mkdirSync(PREFS_DIR, { recursive: true });
  fs.writeFileSync(prefsFile(userId), JSON.stringify({ ...prefs, updatedAt: Date.now() }, null, 2), "utf8");
}

/**
 * Derive updated preferences from a new rating + optional follow-up answers.
 * Called by the feedback endpoint after each session.
 */
export function applyRating(userId, { sessionId, interviewRating, debriefRating, interviewFeedback, debriefFeedback }) {
  const prefs = getPrefs(userId);

  // Record rating
  prefs.ratingHistory.push({ sessionId, interviewRating, debriefRating, ts: Date.now() });
  prefs.sessionCount += 1;

  // Derive interview style from rating
  if (interviewRating !== undefined) {
    if (interviewRating < 3) {
      // Low rating — store the negative feedback, try opposite of current style
      if (interviewFeedback) prefs.interview.negativePatterns.push(interviewFeedback);
      // Flip tone: if they were unhappy with "direct" → try "balanced"; "balanced" → try "warm"
      prefs.interview.tone = { direct: "balanced", balanced: "warm", warm: "balanced" }[prefs.interview.tone] ?? "balanced";
      // Flip detail: if unhappy with "specific" → try "broad", etc.
      prefs.interview.detailLevel = prefs.interview.detailLevel === "specific" ? "broad" : "specific";
    } else if (interviewRating >= 4) {
      // High rating — reinforce current style
      if (interviewFeedback) prefs.interview.positivePatterns.push(interviewFeedback);
    }
    // Keep patterns trimmed to last 5 entries
    prefs.interview.positivePatterns = prefs.interview.positivePatterns.slice(-5);
    prefs.interview.negativePatterns = prefs.interview.negativePatterns.slice(-5);
  }

  // Derive debrief style from rating
  if (debriefRating !== undefined) {
    if (debriefRating < 3) {
      if (debriefFeedback) prefs.debrief.negativePatterns.push(debriefFeedback);
      prefs.debrief.tone = { direct: "balanced", balanced: "encouraging", encouraging: "direct" }[prefs.debrief.tone] ?? "balanced";
      prefs.debrief.detailLevel = { concise: "balanced", balanced: "detailed", detailed: "concise" }[prefs.debrief.detailLevel] ?? "balanced";
    } else if (debriefRating >= 4) {
      if (debriefFeedback) prefs.debrief.positivePatterns.push(debriefFeedback);
    }
    prefs.debrief.positivePatterns = prefs.debrief.positivePatterns.slice(-5);
    prefs.debrief.negativePatterns = prefs.debrief.negativePatterns.slice(-5);
  }

  savePrefs(userId, prefs);
  return prefs;
}

/**
 * Render prefs as a short natural-language block to inject into agent prompts.
 */
export function buildInterviewStyleHint(prefs) {
  if (!prefs || prefs.sessionCount === 0) return "";
  const { interview } = prefs;
  const lines = [
    `USER STYLE PREFERENCES (learned from ${prefs.sessionCount} previous session${prefs.sessionCount > 1 ? "s" : ""}):`,
    `- Question depth: ${interview.detailLevel === "specific" ? "user responds better to concrete, specific questions tied to real examples" : "user prefers broader, exploratory questions"}`,
    `- Tone: ${interview.tone === "direct" ? "be direct and challenging" : interview.tone === "warm" ? "be warm and supportive" : "balance challenge with encouragement"}`,
  ];
  if (interview.positivePatterns.length > 0)
    lines.push(`- User enjoyed: ${interview.positivePatterns.slice(-2).join("; ")}`);
  if (interview.negativePatterns.length > 0)
    lines.push(`- User disliked: ${interview.negativePatterns.slice(-2).join("; ")}`);
  lines.push("IMPORTANT: Apply these preferences to question framing and persona behavior, but never deviate from the research and web data found — use it as the content, preferences only affect style.");
  return lines.join("\n");
}

export function buildDebriefStyleHint(prefs) {
  if (!prefs || prefs.sessionCount === 0) return "";
  const { debrief } = prefs;
  const lines = [
    `USER DEBRIEF PREFERENCES (learned from ${prefs.sessionCount} previous session${prefs.sessionCount > 1 ? "s" : ""}):`,
    `- Detail level: ${debrief.detailLevel === "detailed" ? "user wants very detailed, thorough feedback on every answer" : debrief.detailLevel === "concise" ? "user prefers a concise, punchy debrief — no padding" : "balanced depth — key points with enough detail to be actionable"}`,
    `- Tone: ${debrief.tone === "direct" ? "be direct and honest — user can handle blunt feedback" : debrief.tone === "encouraging" ? "frame feedback constructively — acknowledge effort before critiquing" : "honest but balanced"}`,
  ];
  if (debrief.positivePatterns.length > 0)
    lines.push(`- User appreciated: ${debrief.positivePatterns.slice(-2).join("; ")}`);
  if (debrief.negativePatterns.length > 0)
    lines.push(`- User didn't like: ${debrief.negativePatterns.slice(-2).join("; ")}`);
  return lines.join("\n");
}
