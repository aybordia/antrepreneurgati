import { isEmailApproved } from "./waitlistStore.js";

function decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const expectedClientId = process.env.GOOGLE_CLIENT_ID;
  if (!expectedClientId) {
    console.error("Missing Google client ID. Set GOOGLE_CLIENT_ID in .env.");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const payload = decodeJwtPayload(idToken);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check audience
  if (payload.aud !== expectedClientId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check issuer
  if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check expiry — allow up to 24h grace period so sessions don't die mid-use
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && nowSec > payload.exp + 86400) {
    return res.status(401).json({ error: "Token expired" });
  }

  // Check waitlist approval
  if (!isEmailApproved(payload.email)) {
    return res.status(403).json({ error: "waitlist" });
  }

  req.user = payload;
  next();
}
