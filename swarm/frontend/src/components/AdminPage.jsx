import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export default function AdminPage({ onBack }) {
  const [secret, setSecret] = useState(() => sessionStorage.getItem("admin_secret") || "");
  const [authed, setAuthed] = useState(false);
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [secretInput, setSecretInput] = useState("");

  const apiFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": secret,
        ...(opts.headers || {}),
      },
    });
    if (res.status === 403) throw new Error("Wrong admin secret");
    return res.json();
  }, [secret]);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/emails");
      setEmails(data.emails || []);
      setAuthed(true);
    } catch (e) {
      setStatus(e.message);
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (secret) fetchEmails();
  }, [secret, fetchEmails]);

  const handleLogin = (e) => {
    e.preventDefault();
    sessionStorage.setItem("admin_secret", secretInput);
    setSecret(secretInput);
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setStatus("");
    try {
      const data = await apiFetch("/api/admin/approve", {
        method: "POST",
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      setEmails(data.emails || []);
      setNewEmail("");
      setStatus(`Approved: ${newEmail.trim().toLowerCase()}`);
    } catch (e) {
      setStatus(e.message);
    }
  };

  const handleRevoke = async (email) => {
    setStatus("");
    try {
      const data = await apiFetch("/api/admin/revoke", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setEmails(data.emails || []);
      setStatus(`Removed: ${email}`);
    } catch (e) {
      setStatus(e.message);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
    fontFamily: "var(--mono)",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  };

  const btnStyle = {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "1px solid rgba(123,108,255,0.4)",
    background: "rgba(123,108,255,0.12)",
    color: "#a09aff",
    cursor: "pointer",
    fontFamily: "var(--mono)",
    fontSize: "12px",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
    transition: "all 0.15s",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#04040A", overflow: "auto", padding: "40px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "520px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "32px" }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: "6px 14px", borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--muted)", cursor: "pointer",
                fontFamily: "var(--mono)", fontSize: "11px",
                flexShrink: 0,
              }}
            >
              ← Back
            </button>
          )}
          <div>
            <div style={{ fontFamily: "var(--display)", fontSize: "22px", fontWeight: 300, color: "var(--text)" }}>
              Waitlist Admin
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", opacity: 0.5, marginTop: "2px" }}>
              Approve access to Swarm AI
            </div>
          </div>
        </div>

        {/* Login gate */}
        {!authed ? (
          <div style={{
            background: "rgba(255,255,255,0.028)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "20px", padding: "28px",
          }}>
            <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Enter your admin secret to continue.
            </div>
            <form onSubmit={handleLogin} style={{ display: "flex", gap: "10px" }}>
              <input
                type="password"
                value={secretInput}
                onChange={e => setSecretInput(e.target.value)}
                placeholder="Admin secret…"
                style={inputStyle}
                autoFocus
              />
              <button type="submit" style={btnStyle}>Unlock</button>
            </form>
            {status && (
              <div style={{ marginTop: "12px", fontFamily: "var(--mono)", fontSize: "11px", color: "#ff6b6b" }}>
                {status}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Approve form */}
            <div style={{
              background: "rgba(255,255,255,0.028)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "20px", padding: "24px",
            }}>
              <div style={{ fontFamily: "var(--ui)", fontWeight: 500, fontSize: "13px", color: "var(--text)", marginBottom: "14px" }}>
                Approve a new email
              </div>
              <form onSubmit={handleApprove} style={{ display: "flex", gap: "10px" }}>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="user@gmail.com"
                  style={inputStyle}
                  autoFocus
                />
                <button type="submit" style={btnStyle}>Approve</button>
              </form>
              {status && (
                <div style={{
                  marginTop: "12px", fontFamily: "var(--mono)", fontSize: "11px",
                  color: status.startsWith("Approved") ? "#4DDDAA" : "#ff6b6b",
                }}>
                  {status}
                </div>
              )}
            </div>

            {/* Approved list */}
            <div style={{
              background: "rgba(255,255,255,0.028)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "20px", padding: "24px",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "16px",
              }}>
                <div style={{ fontFamily: "var(--ui)", fontWeight: 500, fontSize: "13px", color: "var(--text)" }}>
                  Approved users
                </div>
                <div style={{
                  fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)",
                  background: "rgba(77,221,170,0.1)", border: "1px solid rgba(77,221,170,0.25)",
                  padding: "2px 10px", borderRadius: "100px", color: "#4DDDAA",
                }}>
                  {emails.length}
                </div>
              </div>

              {loading && (
                <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", opacity: 0.5 }}>
                  Loading…
                </div>
              )}

              {!loading && emails.length === 0 && (
                <div style={{ fontFamily: "var(--ui)", fontSize: "13px", color: "var(--muted)", opacity: 0.5 }}>
                  No approved emails yet.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {emails.map((email) => (
                  <div
                    key={email}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: "10px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span style={{ fontFamily: "var(--mono)", fontSize: "13px", color: "var(--text)" }}>
                      {email}
                    </span>
                    <button
                      onClick={() => handleRevoke(email)}
                      style={{
                        padding: "4px 12px", borderRadius: "6px",
                        border: "1px solid rgba(255,80,80,0.3)",
                        background: "rgba(255,80,80,0.08)",
                        color: "#ff8080", cursor: "pointer",
                        fontFamily: "var(--mono)", fontSize: "10px",
                        letterSpacing: "0.04em", transition: "all 0.15s",
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Note */}
            <div style={{
              fontFamily: "var(--ui)", fontSize: "12px",
              color: "var(--muted)", opacity: 0.45, textAlign: "center", lineHeight: 1.6,
            }}>
              Changes take effect immediately. On server restart, only emails in<br />
              the <code style={{ fontFamily: "var(--mono)", opacity: 0.7 }}>APPROVED_EMAILS</code> env var are restored.
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
