const SESSIONS_KEY = "swarm_sessions";

export function saveSession(snapshot) {
  const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
  sessions.unshift(snapshot);
  if (sessions.length > 10) sessions.pop();
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function getSessions() {
  return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
}

export function clearSessions() {
  localStorage.removeItem(SESSIONS_KEY);
}
