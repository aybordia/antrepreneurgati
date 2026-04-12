// PROMPT VERSION: 1.0
// Last updated: 2026-04-11
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";

const DEFAULT_MODEL = "gpt-4o-mini";

// Lazy client — created on first call so dotenv has time to load
function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Parse "Please try again in 20s" / "in 1m30s" from OpenAI 429 messages
function parseRetryMs(errMessage = "") {
  const secMatch = errMessage.match(/try again in (\d+(?:\.\d+)?)s/);
  if (secMatch) return Math.ceil(parseFloat(secMatch[1])) * 1000 + 500;
  const minSecMatch = errMessage.match(/try again in (\d+)m(\d+(?:\.\d+)?)s/);
  if (minSecMatch) return (parseInt(minSecMatch[1]) * 60 + Math.ceil(parseFloat(minSecMatch[2]))) * 1000 + 500;
  return 22000; // fallback: 22s
}

// Non-streaming call — returns full response text (auto-retries on 429)
export async function callLLM({ systemPrompt, userPrompt, model = DEFAULT_MODEL, maxTokens = 2048 }) {
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

// Streaming call — returns OpenAI stream
export async function streamLLM({ systemPrompt, userPrompt, model = DEFAULT_MODEL, maxTokens = 2048 }) {
  const stream = await getClient().chat.completions.create({
    model,
    max_tokens: maxTokens,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  return stream;
}

// Helper: safely parse JSON from LLM output (strips markdown fences, repairs common issues)
export function parseJSON(raw) {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt repair for common LLM JSON issues (trailing commas, unescaped chars, truncation)
    return JSON.parse(jsonrepair(cleaned));
  }
}
