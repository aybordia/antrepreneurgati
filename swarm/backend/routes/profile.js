// The user's self-set ASD communication profile — read and written here,
// consumed by the interviewer, conversation partner, and debrief agents.
import { getAsdProfile, saveAsdProfile } from "../lib/prefsStore.js";

export function getProfileRoute(req, res) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ error: "auth required" });
  res.json({ profile: getAsdProfile(userId) });
}

export function saveProfileRoute(req, res) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ error: "auth required" });
  const profile = saveAsdProfile(userId, req.body?.profile || req.body || {});
  res.json({ profile });
}
