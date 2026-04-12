// PROMPT VERSION: 1.1
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";

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

// Sliding-window rate limiter — fires immediately unless we're near the limit.
// Gemini: 15 RPM. Groq: generous, no per-minute limit enforced here.
// We track the last 14 request timestamps; only wait if the 14th was < 60s ago.
const requestLog = [];
const MAX_BURST = 14; // one below Gemini's 15 RPM hard limit

async function rateLimit() {
  if (!process.env.GEMINI_API_KEY) return; // Groq has no RPM limit we need to enforce

  const now = Date.now();
  // Evict timestamps older than 60 seconds
  while (requestLog.length > 0 && requestLog[0] < now - 60000) requestLog.shift();

  if (requestLog.length < MAX_BURST) {
    requestLog.push(now);
    return; // under budget — fire immediately
  }

  // At limit: wait until the oldest request is 60s old
  const waitMs = requestLog[0] + 60000 - now + 150;
  console.log(`[llm] rate limit — waiting ${waitMs}ms (${requestLog.length} req in last 60s)`);
  await new Promise(r => setTimeout(r, waitMs));
  requestLog.shift();
  requestLog.push(Date.now());
}

// Parse retry-after from 429 messages. Returns ms to wait, or null to fail fast.
function parseRetryMs(errMessage = "") {
  // Explicit minutes → fail fast, use fallback
  if (/\d+\s*m(?:in)?/i.test(errMessage)) return null;

  // Explicit seconds — require word boundary so "429 status" doesn't match as "429 seconds"
  const secMatch = errMessage.match(/(\d+(?:\.\d+)?)\s*s(?:econds?)?\b/i);
  if (secMatch) {
    const ms = Math.ceil(parseFloat(secMatch[1])) * 1000 + 200;
    return ms > 10000 ? null : ms;
  }

  // No body / unknown format (Gemini RPM burst hit) → wait 4s and retry
  return 4200;
}

function getClient() {
  const { apiKey, baseURL } = getProviderConfig();
  return new OpenAI({ apiKey, baseURL });
}

// Non-streaming call — faster for short outputs (judge responses, fallbacks)
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

// Streaming call — use for long agent outputs that need to stream to SSE
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

// Safely parse JSON from LLM output. Handles markdown fences, preamble, truncated JSON.
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
    console.error("[parseJSON] all repair attempts failed:", e.message, "— raw length:", raw.length);
    return null;
  }
}
