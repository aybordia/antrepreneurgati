import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data/users");

function userFile(userId) {
  // Sanitize userId so it's safe as a filename
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `${safe}.json`);
}

function readUserSessions(userId) {
  const file = userFile(userId);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function writeUserSessions(userId, sessions) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(userFile(userId), JSON.stringify(sessions, null, 2), "utf8");
}

export function getSessions(userId) {
  return readUserSessions(userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveSession(userId, { situation, history, debrief, sessionData }) {
  const sessions = readUserSessions(userId);
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
  writeUserSessions(userId, sessions);
  return session;
}

export function getSession(userId, sessionId) {
  const sessions = readUserSessions(userId);
  return sessions.find(s => s.id === sessionId) || null;
}
