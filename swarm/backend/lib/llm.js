// PROMPT VERSION: 1.4 — wait-and-retry instead of crash on exhaustion
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";

// ── Provider configs ──────────────────────────────────────────────────────────
const GROQ_CFG = {
  apiKey:  process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  model:   "llama-3.1-8b-instant",
  maxRPM:  28,  // Groq free: 30 RPM — leave 2 buffer
};
const GEMINI_CFG = {
  apiKey:  process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  model:   "gemini-2.0-flash",
  maxRPM:  13,  // Gemini free: 15 RPM — leave 2 buffer
};

function providers() {
  const list = [];
  if (GROQ_CFG.apiKey)   list.push(GROQ_CFG);
  if (GEMINI_CFG.apiKey) list.push(GEMINI_CFG);
  return list;
}

// ── Per-provider sliding window rate limiters ─────────────────────────────────
const logs = new Map(); // provider baseURL → timestamp[]
// Providers marked dead for this process lifetime (daily limit hit)
const deadProviders = new Set();

function getLog(cfg) {
  if (!logs.has(cfg.baseURL)) logs.set(cfg.baseURL, []);
  return logs.get(cfg.baseURL);
}

function availableBudget(cfg) {
  if (deadProviders.has(cfg.baseURL)) return -1;
  const log = getLog(cfg);
  const now = Date.now();
  while (log.length && log[0] < now - 60000) log.shift();
  return cfg.maxRPM - log.length;
}

async function acquireSlot(cfg) {
  const log = getLog(cfg);
  const now = Date.now();
  while (log.length && log[0] < now - 60000) log.shift();
  if (log.length < cfg.maxRPM) { log.push(Date.now()); return; }
  const waitMs = log[0] + 60000 - Date.now() + 150;
  console.log(`[llm] ${cfg.model} slot wait ${waitMs}ms`);
  await new Promise(r => setTimeout(r, waitMs));
  log.shift();
  log.push(Date.now());
}

function exhaustKey(cfg) {
  const log = getLog(cfg);
  while (log.length < cfg.maxRPM) log.push(Date.now());
}

// How long until the soonest slot frees up across all live providers
function soonestSlotMs() {
  let soonest = Infinity;
  for (const cfg of providers()) {
    if (deadProviders.has(cfg.baseURL)) continue;
    const log = getLog(cfg);
    if (log.length > 0) {
      const freeAt = log[0] + 60000 + 300;
      if (freeAt < soonest) soonest = freeAt;
    } else {
      return 0;
    }
  }
  if (soonest === Infinity) return 3000;
  // Cap at 8s — we'd rather fail fast and use fallback than hang for a minute
  return Math.min(Math.max(300, soonest - Date.now()), 8000);
}

// ── Retry-after parser ────────────────────────────────────────────────────────
function parseRetryMs(msg = "") {
  // "please try again tomorrow" or minute-scale waits → mark dead
  if (/tomorrow|daily|24\s*h/i.test(msg)) return "dead";
  if (/\d+\s*m(?:in)?\b/i.test(msg)) return null;
  const m = msg.match(/(\d+(?:\.\d+)?)\s*s(?:econds?)?\b/i);
  if (m) { const ms = Math.ceil(parseFloat(m[1])) * 1000 + 200; return ms > 10000 ? null : ms; }
  return 4200;
}

// ── Core call ─────────────────────────────────────────────────────────────────
async function _doCall(cfg, systemPrompt, userPrompt, maxTokens, stream, onChunk) {
  await acquireSlot(cfg);
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const msgs = [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }];
  if (stream) {
    const s = await client.chat.completions.create({ model: cfg.model, max_tokens: maxTokens, stream: true, messages: msgs });
    let full = "", buf = "";
    for await (const part of s) {
      const tok = part.choices[0]?.delta?.content || "";
      if (!tok) continue;
      full += tok; buf += tok;
      if (buf.length >= 15) { onChunk(buf); buf = ""; }
    }
    if (buf) onChunk(buf);
    return full;
  }
  const r = await client.chat.completions.create({ model: cfg.model, max_tokens: maxTokens, messages: msgs });
  return r.choices[0].message.content;
}

async function _call({ systemPrompt, userPrompt, maxTokens, stream = false, onChunk = () => {}, _retries = 0 }) {
  if (_retries > 3) throw new Error("All providers exhausted after maximum retries");

  const providerList = providers().filter(p => !deadProviders.has(p.baseURL));
  if (!providerList.length) throw new Error("No API keys configured (GROQ_API_KEY or GEMINI_API_KEY required)");

  // Pick the provider with most remaining budget first
  providerList.sort((a, b) => availableBudget(b) - availableBudget(a));

  for (const cfg of providerList) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await _doCall(cfg, systemPrompt, userPrompt, maxTokens, stream, onChunk);
      } catch (err) {
        if (err?.status === 429) {
          const waitMs = parseRetryMs(err?.message || "");
          if (waitMs === "dead") {
            // Daily limit hit — permanently skip this provider for this process
            deadProviders.add(cfg.baseURL);
            console.log(`[llm] ${cfg.model} daily limit hit — marking dead for this session`);
            break;
          }
          if (waitMs === null) {
            exhaustKey(cfg);
            console.log(`[llm] ${cfg.model} long 429 — rotating to next provider`);
            break;
          }
          console.log(`[llm] ${cfg.model} 429 — waiting ${waitMs}ms (attempt ${attempt + 1})`);
          await new Promise(r => setTimeout(r, waitMs));
        } else {
          throw err;
        }
      }
    }
  }

  // All providers temporarily exhausted — wait for soonest slot instead of crashing
  const waitMs = soonestSlotMs();
  console.log(`[llm] all providers busy — waiting ${waitMs}ms for next slot (retry ${_retries + 1}/10)`);
  await new Promise(r => setTimeout(r, waitMs));
  return _call({ systemPrompt, userPrompt, maxTokens, stream, onChunk, _retries: _retries + 1 });
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function callLLM({ systemPrompt, userPrompt, model, maxTokens = 2048 }) {
  return _call({ systemPrompt, userPrompt, maxTokens });
}

export async function callLLMStream({ systemPrompt, userPrompt, model, maxTokens = 2048, onChunk }) {
  return _call({ systemPrompt, userPrompt, maxTokens, stream: true, onChunk });
}

// ── JSON parser ───────────────────────────────────────────────────────────────
export function parseJSON(raw) {
  if (!raw) return null;
  let cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
    try { return JSON.parse(jsonrepair(match[0])); } catch {}
  }
  try { return JSON.parse(jsonrepair(cleaned)); } catch (e) {
    console.error("[parseJSON] failed:", e.message);
    return null;
  }
}
