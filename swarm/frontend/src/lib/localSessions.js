const KEY = "swarm_sessions";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(sessions) {
  localStorage.setItem(KEY, JSON.stringify(sessions));
}

export function getSessions(userId) {
  return readAll()
    .filter(s => s.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function saveSession(userId, { situation, history, debrief, sessionData }) {
  const sessions = readAll();
  const session = {
    id: crypto.randomUUID(),
    userId,
    situation,
    history: history || [],
    debrief: debrief || null,
    sessionData: sessionData || null,
    createdAt: Date.now(),
  };
  sessions.push(session);
  writeAll(sessions);
  return session;
}

export function getSession(userId, sessionId) {
  return readAll().find(s => s.userId === userId && s.id === sessionId) || null;
}
