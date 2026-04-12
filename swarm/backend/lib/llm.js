// PROMPT VERSION: 1.0
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";

// Use Gemini if key is set (1M TPM free), otherwise fall back to Groq (500k TPD)
function getProviderConfig() {
  if (process.env.GEMINI_API_KEY) {
    return {
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      model: "gemini-2.0-flash",
    };
  }
  return {
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
  };
}

const DEFAULT_MODEL = null; // resolved per-call from getProviderConfig()

// Gemini free tier: 15 RPM = 1 call per 4s minimum
let lastCallTime = 0;
const MIN_INTERVAL_MS = 4200;

async function rateLimit() {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastCallTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallTime = Date.now();
}

// Lazy client — created on first call so dotenv has time to load
function getClient() {
  const { apiKey, baseURL } = getProviderConfig();
  return new OpenAI({ apiKey, baseURL });
}

// Parse retry-after from 429 messages. Returns ms to wait, or null to fail fast.
function parseRetryMs(errMessage = "") {
  // Explicit minutes → fail fast, use fallback
  if (/\d+\s*m(?:in)?/i.test(errMessage)) return null;

  // Explicit seconds
  const secMatch = errMessage.match(/(\d+(?:\.\d+)?)\s*s(?:econds?)?/i);
  if (secMatch) {
    const ms = Math.ceil(parseFloat(secMatch[1])) * 1000 + 200;
    return ms > 10000 ? null : ms;
  }

  // No body / unknown format (Gemini RPM hit) → wait 4s and retry
  return 4200;
}

// Non-streaming call — returns full response text
export async function callLLM({ systemPrompt, userPrompt, model, maxTokens = 2048 }) {
  await rateLimit();
  const resolvedModel = model || getProviderConfig().model;
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: resolvedModel,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      return response.choices[0].message.content;
    } catch (err) {
      if (err?.status === 429 && attempt < maxRetries) {
        const waitMs = parseRetryMs(err?.message);
        if (waitMs === null) {
          console.log(`[llm] 429 rate limit with long retry-after — failing fast for fallback`);
          throw err;
        }
        console.log(`[llm] 429 rate limit — waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        throw err;
      }
    }
  }
}

// Streaming call — rate-paced, pipes tokens to onChunk callback, returns full text
export async function callLLMStream({ systemPrompt, userPrompt, model, maxTokens = 2048, onChunk }) {
  await rateLimit();
  const resolvedModel = model || getProviderConfig().model;
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const stream = await getClient().chat.completions.create({
        model: resolvedModel,
        max_tokens: maxTokens,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      let full = "";
      let buf = "";
      for await (const part of stream) {
        const token = part.choices[0]?.delta?.content || "";
        if (!token) continue;
        full += token;
        buf += token;
        if (buf.length >= 15) {
          onChunk(buf);
          buf = "";
        }
      }
      if (buf) onChunk(buf);
      return full;
    } catch (err) {
      if (err?.status === 429 && attempt < maxRetries) {
        const waitMs = parseRetryMs(err?.message);
        if (waitMs === null) {
          console.log(`[llm] 429 rate limit with long retry-after — failing fast for fallback`);
          throw err;
        }
        console.log(`[llm] 429 rate limit — waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        throw err;
      }
    }
  }
}

// Helper: safely parse JSON from LLM output.
// Handles markdown fences, preamble text, and truncated JSON.
// Returns null instead of throwing so callers can supply fallbacks.
export function parseJSON(raw) {
  if (!raw) return null;

  // Strip markdown fences
  let cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();

  // Try direct parse first
  try { return JSON.parse(cleaned); } catch {}

  // Extract the first {...} block in case there's preamble text (common with gemma models)
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
    try { return JSON.parse(jsonrepair(match[0])); } catch {}
  }

  // Last resort: try to repair the full cleaned string
  try { return JSON.parse(jsonrepair(cleaned)); } catch (e) {
    console.error("[parseJSON] all repair attempts failed:", e.message, "— raw length:", raw.length);
    return null;
  }
}
