/**
 * POST /api/feedback
 * Saves a session rating + optional follow-up text, updates user preferences.
 * Body: { sessionId, interviewRating, debriefRating, interviewFeedback?, debriefFeedback? }
 */
import { applyRating } from "../lib/prefsStore.js";

export default async function handler(req, res) {
  const userId = req.user?.sub;
  const { sessionId, interviewRating, debriefRating, interviewFeedback, debriefFeedback } = req.body;

  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  if (interviewRating === undefined && debriefRating === undefined)
    return res.status(400).json({ error: "at least one rating required" });

  try {
    const updatedPrefs = applyRating(userId, {
      sessionId,
      interviewRating: interviewRating !== undefined ? Number(interviewRating) : undefined,
      debriefRating:   debriefRating   !== undefined ? Number(debriefRating)   : undefined,
      interviewFeedback: interviewFeedback?.trim() || undefined,
      debriefFeedback:   debriefFeedback?.trim()   || undefined,
    });

    console.log(`[feedback] user=${userId} interview=${interviewRating} debrief=${debriefRating} sessions=${updatedPrefs.sessionCount}`);
    res.json({ ok: true, sessionCount: updatedPrefs.sessionCount });
  } catch (err) {
    console.error("[feedback] error:", err);
    res.status(500).json({ error: err.message });
  }
}
