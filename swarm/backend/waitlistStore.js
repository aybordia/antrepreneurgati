// In-memory approved email store.
// Seeded on startup from APPROVED_EMAILS env var (comma-separated).
// Use the admin API to approve/revoke at runtime — no restart needed.

const _approved = new Set(
  (process.env.APPROVED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isEmailApproved(email) {
  if (!email) return false;
  return _approved.has(email.trim().toLowerCase());
}

export function approveEmail(email) {
  _approved.add(email.trim().toLowerCase());
}

export function revokeEmail(email) {
  _approved.delete(email.trim().toLowerCase());
}

export function listApproved() {
  return [..._approved].sort();
}
