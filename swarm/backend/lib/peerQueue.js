// In-memory matching queue for peer practice + file-backed blocks/reports.
// Queue state is per-process (fine for a single backend instance); blocks and
// reports persist to disk so safety data survives restarts.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PEER_DIR = path.join(__dirname, "../data/peer");
const BLOCKS_FILE = path.join(PEER_DIR, "blocks.json");
const REPORTS_FILE = path.join(PEER_DIR, "reports.json");

const QUEUE_TTL_MS = 5 * 60 * 1000;   // waiting entries expire after 5 min
const MATCH_TTL_MS = 65 * 60 * 1000;  // match records live slightly past room expiry

// userId → { userId, handle, mode, topic, ts }
const queue = new Map();
// userId → { matchId, room, partnerId, partnerHandle, mode, ts }
const matches = new Map();

// ── Persistence helpers ───────────────────────────────────────────────────────
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.mkdirSync(PEER_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// ── Blocks ────────────────────────────────────────────────────────────────────
export function blockUser(userId, blockedId) {
  const blocks = readJSON(BLOCKS_FILE, {});
  blocks[userId] = [...new Set([...(blocks[userId] || []), blockedId])];
  writeJSON(BLOCKS_FILE, blocks);
}

export function isBlockedEitherWay(a, b) {
  const blocks = readJSON(BLOCKS_FILE, {});
  return (blocks[a] || []).includes(b) || (blocks[b] || []).includes(a);
}

// ── Reports ───────────────────────────────────────────────────────────────────
export function fileReport({ reporterId, reportedId, matchId, reason, details }) {
  const reports = readJSON(REPORTS_FILE, []);
  reports.push({
    id: crypto.randomUUID(),
    reporterId, reportedId: reportedId || null, matchId: matchId || null,
    reason: String(reason || "").slice(0, 200),
    details: String(details || "").slice(0, 2000),
    createdAt: new Date().toISOString(),
  });
  writeJSON(REPORTS_FILE, reports);
}

// ── Queue + matching ──────────────────────────────────────────────────────────
function pruneQueue() {
  const now = Date.now();
  for (const [id, entry] of queue) {
    if (now - entry.ts > QUEUE_TTL_MS) queue.delete(id);
  }
  for (const [id, m] of matches) {
    if (now - m.ts > MATCH_TTL_MS) matches.delete(id);
  }
}

/**
 * Join the queue. If a compatible partner is already waiting, both are matched
 * and the caller receives the match; the partner picks it up on their next poll.
 * `createRoom` is injected so this module stays testable without Daily.
 */
export async function joinQueue({ userId, handle, mode, topic }, createRoom) {
  pruneQueue();

  // Already matched (e.g. double-click) → return existing match
  if (matches.has(userId)) return { status: "matched", ...matches.get(userId) };

  // Find a compatible waiting partner: same mode, not self, not blocked either way
  for (const [otherId, other] of queue) {
    if (otherId === userId) continue;
    if (other.mode !== mode) continue;
    if (isBlockedEitherWay(userId, otherId)) continue;

    queue.delete(otherId);
    queue.delete(userId);
    const room = await createRoom();
    const matchId = crypto.randomUUID();
    const base = { matchId, room, mode, ts: Date.now() };
    matches.set(userId, { ...base, partnerId: otherId, partnerHandle: other.handle });
    matches.set(otherId, { ...base, partnerId: userId, partnerHandle: handle });
    return { status: "matched", ...matches.get(userId) };
  }

  queue.set(userId, { userId, handle, mode, topic: topic || null, ts: Date.now() });
  return { status: "waiting" };
}

export function getStatus(userId) {
  pruneQueue();
  if (matches.has(userId)) return { status: "matched", ...matches.get(userId) };
  if (queue.has(userId)) return { status: "waiting" };
  return { status: "idle" };
}

export function leaveQueue(userId) {
  queue.delete(userId);
}

export function endMatch(userId) {
  matches.delete(userId);
}
