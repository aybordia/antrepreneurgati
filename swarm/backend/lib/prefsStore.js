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

// The self-set profile of the autistic user themselves. This is the heart of
// personalization: every field is optional, self-identified, and framed as a
// communication difference to accommodate — never a deficit to fix. It is
// injected into the live interviewer, the conversation partner, and the debrief
// so the whole experience adapts to THIS person, not to a generic "ASD user".
const DEFAULT_ASD_PROFILE = () => ({
  set: false,               // has the user completed it at least once?
  literal: false,           // takes language literally; idioms/hypotheticals are hard
  processingTime: false,    // needs extra time to think before answering
  openEndedHard: false,     // broad openers ("tell me about yourself") are hard to start
  detailStyle: "",          // "" | "detailed" (gives lots of detail) | "brief" (gives short answers)
  shutdown: false,          // may go quiet / blank under stress
  needsBreaks: false,       // may need a short break
  wantWritten: false,       // wants every question shown in writing
  wantTopicWarning: false,  // wants a heads-up before the topic changes
  strengths: "",            // free text: knowledge areas, precision, honesty…
  goal: "",                 // free text: what they want to practise
  notes: "",                // anything else they want the panel to know
  updatedAt: 0,
});

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
  asdProfile: DEFAULT_ASD_PROFILE(),
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

// ── ASD profile (self-set, the core of personalization) ─────────────────────

export function getAsdProfile(userId) {
  const prefs = getPrefs(userId);
  // Merge over defaults so profiles saved before a field existed still load
  return { ...DEFAULT_ASD_PROFILE(), ...(prefs.asdProfile || {}) };
}

export function saveAsdProfile(userId, incoming = {}) {
  const prefs = getPrefs(userId);
  const clean = (s, max) => (typeof s === "string" ? s.trim().slice(0, max) : "");
  const bool = (v) => v === true;
  const detail = ["detailed", "brief"].includes(incoming.detailStyle) ? incoming.detailStyle : "";
  prefs.asdProfile = {
    set: true,
    literal: bool(incoming.literal),
    processingTime: bool(incoming.processingTime),
    openEndedHard: bool(incoming.openEndedHard),
    detailStyle: detail,
    shutdown: bool(incoming.shutdown),
    needsBreaks: bool(incoming.needsBreaks),
    wantWritten: bool(incoming.wantWritten),
    wantTopicWarning: bool(incoming.wantTopicWarning),
    strengths: clean(incoming.strengths, 400),
    goal: clean(incoming.goal, 400),
    notes: clean(incoming.notes, 600),
    updatedAt: Date.now(),
  };
  savePrefs(userId, prefs);
  return prefs.asdProfile;
}

/**
 * Turn the self-set profile into concrete behavioral directives for an agent.
 * context: "interview" | "conversation" | "debrief".
 * Returns "" when the user hasn't set a profile, so callers can drop it cleanly.
 */
export function buildAsdProfileHint(profile, context = "interview") {
  if (!profile || !profile.set) return "";
  const forDebrief = context === "debrief";
  const forConvo = context === "conversation";
  const who = forConvo ? "this conversation partner" : "this person";
  const lines = [];

  if (profile.literal) {
    lines.push(forDebrief
      ? `They interpret language literally. If any of your feedback could be read literally in a way you didn't mean, reword it. No idioms or metaphors.`
      : `They interpret language literally. Ask concrete, literal questions. If anything you say is abstract or hypothetical, say plainly there is no trick and they can ask what you mean.`);
  }
  if (profile.processingTime && !forDebrief) {
    lines.push(`They need time to think. After you ask something, do not fill the silence, rephrase, or rush them. A pause means they are thinking — wait.`);
  }
  if (profile.openEndedHard) {
    lines.push(forDebrief
      ? `Broad, open questions are hard for them to start. If you suggest anything to practise, give a concrete opening they can reuse (e.g. a first sentence), not just "be more open".`
      : `Broad openers are hard for them to start. Prefer specific, concrete questions. If you must open broadly, immediately offer a concrete place to start (e.g. "you could begin with what you studied").`);
  }
  if (profile.detailStyle === "detailed") {
    lines.push(forDebrief
      ? `They tend to give a lot of detail. Treat thoroughness as the strength it is. If a shorter answer would land better, frame it as "lead with your single strongest point", never as "you talked too much".`
      : `They tend to give a lot of detail — that is a strength (thoroughness, real knowledge). Never cut them off. If an answer is very long, gently invite the single most important part without implying they did anything wrong.`);
  }
  if (profile.detailStyle === "brief") {
    lines.push(forDebrief
      ? `They tend to give short answers. Encourage adding one concrete example, framed as an invitation, never as a criticism.`
      : `They tend to give short answers. Ask one concrete, specific follow-up to invite more. Never pressure or imply the short answer was wrong.`);
  }
  if (profile.shutdown && !forDebrief) {
    lines.push(`If they go quiet, blank, or say they are stuck, ease off immediately: reassure them warmly, offer to move on or come back to it later, and never push.`);
  }
  if (profile.needsBreaks && !forDebrief) {
    lines.push(`If they ask for a break or a moment, welcome it warmly and without any fuss.`);
  }
  if (profile.wantWritten && !forDebrief) {
    lines.push(`They want every question available in writing. Phrase each question as one clean sentence so the on-screen text reads clearly on its own.`);
  }
  if (profile.wantTopicWarning && !forConvo && !forDebrief) {
    lines.push(`Announce topic changes before you make them ("Now I'd like to move to a different area…") so nothing is a surprise.`);
  }
  if (profile.strengths) {
    lines.push(forDebrief
      ? `Name these strengths plainly wherever they show up in the transcript: ${profile.strengths}.`
      : `Where it fits naturally, give them room to show these strengths: ${profile.strengths}.`);
  }
  if (profile.goal) {
    lines.push(forDebrief
      ? `Their goal for this session was: "${profile.goal}". Make the single highest-leverage focus point speak directly to that goal.`
      : `Their goal for this session is: "${profile.goal}". Where you naturally can, give them chances to practise exactly that.`);
  }
  if (profile.notes) {
    lines.push(`They also asked you to keep in mind: ${profile.notes}`);
  }

  if (!lines.length) return "";
  const header = forDebrief
    ? `This candidate's own profile (they set this themselves — honor it):`
    : `About ${who} (they set this profile themselves — honor every point):`;
  return `${header}\n- ${lines.join("\n- ")}`;
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
