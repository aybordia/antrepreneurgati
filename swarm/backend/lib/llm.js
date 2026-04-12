// PROMPT VERSION: 1.0
// Last updated: 2026-04-11 — switched to Groq (llama-3.3-70b-versatile)
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";

// Groq is OpenAI-API-compatible — just swap the base URL and key
const DEFAULT_MODEL = "llama-3.1-8b-instant";

// Groq free tier: 30 RPM — tiny gap is enough; retry handles any burst 429s
let lastCallTime = 0;
const MIN_INTERVAL_MS = 1000;

async function rateLimit() {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastCallTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallTime = Date.now();
}

// Lazy client — created on first call so dotenv has time to load
function getClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

// Parse retry-after from Groq/OpenAI 429 messages — cap at 65s
function parseRetryMs(errMessage = "") {
  const secMatch = errMessage.match(/(\d+(?:\.\d+)?)\s*s(?:econds?)?/i);
  if (secMatch) return Math.min(Math.ceil(parseFloat(secMatch[1])) * 1000 + 500, 65000);
  const minMatch = errMessage.match(/(\d+)\s*m(?:in)?.*?(\d+(?:\.\d+)?)\s*s/i);
  if (minMatch) return Math.min((parseInt(minMatch[1]) * 60 + Math.ceil(parseFloat(minMatch[2]))) * 1000 + 500, 65000);
  return 10000;
}

// Non-streaming call — returns full response text
export async function callLLM({ systemPrompt, userPrompt, model = DEFAULT_MODEL, maxTokens = 2048 }) {
  await rateLimit();
  const maxRetries = 4;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model,
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
        console.log(`[llm] 429 rate limit — waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        throw err;
      }
    }
  }
}

// Streaming call — rate-paced, pipes tokens to onChunk callback, returns full text
export async function callLLMStream({ systemPrompt, userPrompt, model = DEFAULT_MODEL, maxTokens = 2048, onChunk }) {
  await rateLimit();
  const maxRetries = 4;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const stream = await getClient().chat.completions.create({
        model,
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
        console.log(`[llm] 429 rate limit — waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        throw err;
      }
    }
  }
}

// Helper: safely parse JSON from LLM output (strips markdown fences, repairs common issues)
export function parseJSON(raw) {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(jsonrepair(cleaned));
  }
}
