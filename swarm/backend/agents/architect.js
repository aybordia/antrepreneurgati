// PROMPT VERSION: 2.0 — fully dynamic sessions: LLM-invented fictional personas
// (no hardcoded name/title/institution lists) + domain-tagged question bank.
import { generatePersonas } from "./personaGenerator.js";
import { composeSessionQuestions } from "../lib/questionBank.js";
import { parseIntent } from "./intentParser.js";

// Assign each question to the persona whose focus matches, balancing load
function assignQuestions(questions, personas) {
  const load = new Map(personas.map(p => [p.name, 0]));
  return questions.map(q => {
    const candidates = [...personas].sort((a, b) => {
      const aMatch = a.question_focus === q.type || a.question_focus === "mixed" ? 0 : 1;
      const bMatch = b.question_focus === q.type || b.question_focus === "mixed" ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return load.get(a.name) - load.get(b.name);
    });
    const chosen = candidates[0];
    load.set(chosen.name, load.get(chosen.name) + 1);
    return {
      text: q.text,
      type: q.type,
      domain: q.domain,
      assignedPersona: chosen.name,
      intent: q.type === "technical" ? "Domain question" : q.type === "motivational" ? "Motivation" : "Behavioral",
    };
  });
}

export async function runArchitect({ situation, intent = null, researcherOutput, styleHint, researchContext }, writeChunk) {
  // Derive structured intent server-side if the client didn't send one
  if (!intent) {
    writeChunk({ agent: "Architect", chunk: "Understanding your request…", thinking: true });
    try {
      intent = await parseIntent({ transcript: situation });
    } catch {
      intent = { institution: null, program_type: null, timeframe_days: null, num_interviewers: 3, domain: "general" };
    }
  }

  writeChunk({ agent: "Architect", chunk: "Inventing your fictional interview panel…", thinking: true });
  const personas = await generatePersonas({ intent, situation });

  writeChunk({ agent: "Architect", chunk: "Composing your question set…", thinking: true });
  const totalQuestions = Math.max(4, personas.length);
  let bankQuestions;
  try {
    bankQuestions = await composeSessionQuestions({
      domain: intent?.domain || "general",
      totalQuestions,
      intent,
    });
  } catch (e) {
    console.error("[architect] question composition failed:", e.message);
    bankQuestions = (await composeSessionQuestions({ domain: "general", totalQuestions, intent: null, useLLM: false }));
  }
  const questions = assignQuestions(bankQuestions, personas);

  writeChunk({ agent: "Architect", chunk: "Session architected.", streamStart: true });

  const rc = researcherOutput || {};
  const sessionData = {
    agent: "Architect",
    situation,
    intent,
    sessionSummary: intent?.institution
      ? `Practice ${intent.program_type || ""} interview for ${intent.institution} with ${personas.length} simulated interviewer${personas.length > 1 ? "s" : ""}.`
      : `Practice session for: ${situation}`,
    personas,
    sessionPlan: {
      difficultyProgression: "gentle-start",
      totalEstimatedMinutes: Math.max(5, questions.length + 1),
      questions,
    },
    openingLine: "",
    closingCondition: "After all planned questions are covered.",
    researchContext: {
      ...researchContext,
      psychologicalProfile: "",
      diagnosedWeakness: researchContext?.interviewerPatterns?.slice(0, 80) || "",
    },
  };

  writeChunk({ agent: "Architect", done: true, sessionData });
  return sessionData;
}
