// Domain-tagged question bank: static reviewed seed for reliability,
// with optional LLM-generated extras layered on top.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { callLLM, parseJSON } from "./llm.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK = JSON.parse(readFileSync(join(__dirname, "../data/questionBank.json"), "utf-8")).questions;

function pick(arr, n) {
  const a = [...arr];
  const out = [];
  while (a.length && out.length < n) {
    out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  }
  return out;
}

// Try to generate extra domain questions via the LLM; static bank is the fallback.
async function generateDomainQuestions({ domain, intent, count }) {
  try {
    const raw = await callLLM({
      systemPrompt: `You write mock-interview questions for the "${domain}" domain. Clear, literal, direct wording — no idioms, no trick phrasing, one question per item. Return ONLY: {"questions":["...","..."]}`,
      userPrompt: `Context: ${intent?.institution || "an institution"}, ${intent?.program_type || "interview"}. Write ${count} domain-specific questions (light-to-medium difficulty).`,
      maxTokens: 300,
    });
    const parsed = parseJSON(raw);
    if (parsed?.questions?.length) {
      return parsed.questions
        .filter(q => typeof q === "string" && q.trim().length > 10)
        .slice(0, count)
        .map(text => ({ domain, type: "technical", difficulty: "light", text, generated: true }));
    }
  } catch (e) {
    console.error("[questionBank] LLM generation failed, using static bank:", e.message);
  }
  return [];
}

/**
 * Composition rule: 1-2 technical questions matched to `domain`,
 * remainder pulled from the general/behavioral/motivational pool.
 */
export async function composeSessionQuestions({ domain = "general", totalQuestions = 4, intent = null, useLLM = true }) {
  const technicalCount = domain === "general" ? 0 : Math.min(2, Math.max(1, totalQuestions - 2));

  let technical = [];
  if (technicalCount > 0) {
    const bankTechnical = BANK.filter(q => q.domain === domain && q.type === "technical");
    if (useLLM) technical = await generateDomainQuestions({ domain, intent, count: technicalCount });
    if (technical.length < technicalCount) {
      technical = [...technical, ...pick(bankTechnical, technicalCount - technical.length)];
    }
  }

  const generalPool = BANK.filter(q => q.domain === "general");
  const motivational = pick(generalPool.filter(q => q.type === "motivational"), 1);

  // One deliberately underspecified question per session: practicing
  // clarification-seeking is an evidence-supported interview skill
  // (asking "which do you mean?" is the ideal response, and is welcomed).
  const clarification = pick(generalPool.filter(q => q.type === "clarification"), 1);

  const behavioralNeeded = totalQuestions - technical.length - motivational.length - clarification.length;
  const behavioral = pick(generalPool.filter(q => q.type === "behavioral"), Math.max(behavioralNeeded, 0));

  // Order: motivational warm-up → behavioral → technical → clarification → behavioral close
  const ordered = [
    ...motivational,
    ...behavioral.slice(0, 1),
    ...technical,
    ...clarification,
    ...behavioral.slice(1),
  ].slice(0, totalQuestions);

  return ordered;
}

export function getBankQuestions(filter = {}) {
  return BANK.filter(q =>
    (!filter.domain || q.domain === filter.domain) &&
    (!filter.type || q.type === filter.type)
  );
}
