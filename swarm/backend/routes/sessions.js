import { getSessions, saveSession, getSession } from "../lib/sessionStore.js";

export async function listSessions(req, res) {
  try {
    const userId = req.user.sub;
    const sessions = await getSessions(userId);
    res.json(sessions.map(s => ({
      id:             s.id,
      situation:      s.situation,
      createdAt:      s.createdAt,
      clarityScore:   s.debrief?.clarityScore ?? null,
      overallVerdict: s.debrief?.overallVerdict ?? null,
      turnCount:      s.history?.length ?? 0,
    })));
  } catch (err) {
    console.error("listSessions error:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function saveSessionRoute(req, res) {
  try {
    const userId = req.user.sub;
    const { situation, history, debrief, sessionData } = req.body;
    const session = await saveSession(userId, { situation, history, debrief, sessionData });
    res.json({ id: session.id });
  } catch (err) {
    console.error("saveSession error:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function getSessionRoute(req, res) {
  try {
    const userId = req.user.sub;
    const session = await getSession(userId, req.params.id);
    if (!session) return res.status(404).json({ error: "Not found" });
    res.json(session);
  } catch (err) {
    console.error("getSession error:", err);
    res.status(500).json({ error: err.message });
  }
}
