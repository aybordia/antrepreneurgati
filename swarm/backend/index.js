import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import startSession from "./routes/startSession.js";
import voiceTurn from "./routes/voiceTurn.js";
import debrief from "./routes/debrief.js";
import querySession from "./routes/querySession.js";
import askSwarm from "./routes/askSwarm.js";
import { listSessions, saveSessionRoute, getSessionRoute } from "./routes/sessions.js";
import feedback from "./routes/feedback.js";
import { verifyToken } from "./googleAuth.js";
import { isEmailApproved, approveEmail, revokeEmail, listApproved } from "./waitlistStore.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  /\.vercel\.app$/,
  "https://swarm-ai-ruddy.vercel.app",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some((o) => typeof o === "string" ? o === origin : o.test(origin))) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
}));

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Public — check if an email is on the approved waitlist (no auth required)
app.post("/api/waitlist/check", (req, res) => {
  const { email } = req.body || {};
  res.json({ approved: isEmailApproved(email) });
});

// Admin middleware — protected by ADMIN_SECRET env var
function adminAuth(req, res, next) {
  const secret = req.headers["x-admin-secret"] || req.body?.adminSecret;
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

app.get("/api/admin/emails", adminAuth, (req, res) => {
  res.json({ emails: listApproved() });
});

app.post("/api/admin/approve", adminAuth, (req, res) => {
  const { email } = req.body || {};
  if (!email?.trim()) return res.status(400).json({ error: "email required" });
  approveEmail(email);
  res.json({ ok: true, email: email.trim().toLowerCase(), emails: listApproved() });
});

app.post("/api/admin/revoke", adminAuth, (req, res) => {
  const { email } = req.body || {};
  if (!email?.trim()) return res.status(400).json({ error: "email required" });
  revokeEmail(email);
  res.json({ ok: true, emails: listApproved() });
});

app.post("/api/start-session", verifyToken, startSession);
app.post("/api/voice-turn", verifyToken, voiceTurn);
app.post("/api/debrief", verifyToken, debrief);
app.post("/api/query-session", verifyToken, querySession);
app.post("/api/ask-swarm", verifyToken, askSwarm);
app.get("/api/sessions", verifyToken, listSessions);
app.post("/api/sessions/save", verifyToken, saveSessionRoute);
app.get("/api/sessions/:id", verifyToken, getSessionRoute);
app.post("/api/feedback", verifyToken, feedback);

// Global error handler — prevents raw Express error pages in production
app.use((err, req, res, next) => {
  console.error("[global error]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Swarm backend running on :${PORT}`));
