// PROMPT VERSION: 1.3 — Groq primary (30 RPM), Gemini backup (15 RPM)
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

// Use Groq as primary (30 RPM). If no Groq key, use Gemini. Groq falls back to Gemini on long 429s.
function providers() {
  const list = [];
  if (GROQ_CFG.apiKey)   list.push(GROQ_CFG);
  if (GEMINI_CFG.apiKey) list.push(GEMINI_CFG);
  return list; // first = primary
}

// ── Per-provider sliding window rate limiters ─────────────────────────────────
const logs = new Map(); // provider baseURL → timestamp[]

function getLog(cfg) {
  if (!logs.has(cfg.baseURL)) logs.set(cfg.baseURL, []);
  return logs.get(cfg.baseURL);
}

function availableBudget(cfg) {
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
  // Mark this provider as over-limit so next call uses the backup
  const log = getLog(cfg);
  while (log.length < cfg.maxRPM) log.push(Date.now());
}

// ── Retry-after parser ────────────────────────────────────────────────────────
function parseRetryMs(msg = "") {
  if (/\d+\s*m(?:in)?/i.test(msg)) return null;
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

async function _call({ systemPrompt, userPrompt, maxTokens, stream = false, onChunk = () => {} }) {
  const providerList = providers();
  if (!providerList.length) throw new Error("No API keys configured (GROQ_API_KEY or GEMINI_API_KEY required)");

  // Pick the provider with most remaining budget
  providerList.sort((a, b) => availableBudget(b) - availableBudget(a));

  for (let pi = 0; pi < providerList.length; pi++) {
    const cfg = providerList[pi];
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await _doCall(cfg, systemPrompt, userPrompt, maxTokens, stream, onChunk);
      } catch (err) {
        if (err?.status === 429) {
          const waitMs = parseRetryMs(err?.message);
          if (waitMs === null) {
            // Long wait → exhaust this provider and try the next one
            exhaustKey(cfg);
            console.log(`[llm] ${cfg.model} long 429 — rotating to next provider`);
            break; // break inner retry loop, continue to next provider
          }
          console.log(`[llm] ${cfg.model} 429 — waiting ${waitMs}ms (attempt ${attempt + 1})`);
          await new Promise(r => setTimeout(r, waitMs));
        } else {
          throw err;
        }
      }
    }
  }
  throw new Error("All providers exhausted");
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
