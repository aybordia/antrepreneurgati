// Debrief v2 — private, post-session, non-scored.
// Aggregates: full transcript + per-persona LLM impressions (constructive
// observations, never pass/fail) + neutral tracking-signal summaries.
// Signal categories render only if the user opted in (user_selected_categories).
import { callLLM, parseJSON } from "../lib/llm.js";
import { summarizeSignals } from "../lib/signalSummary.js";

const IMPRESSIONS_PROMPT = `You write post-interview impressions from FICTIONAL simulated interviewers for a private practice debrief.
Return ONLY valid JSON: {"impressions":[{"persona":"<name>","impression":"..."}]}

Rules for every impression:
- Written in that persona's voice, consistent with their described style.
- 2-4 sentences: what stood out in the CONTENT of the candidate's answers (specific — quote or reference actual things they said), then at most one optional, concrete suggestion.
- Constructive and private. NEVER a score, grade, ranking, or pass/fail judgment.
- NEVER comment on pauses, thinking time, pacing, speech patterns, tone of voice, eye contact, or body language. Content only.
- Never suggest the candidate act more "normal", hide their personality, or perform differently as a person. Suggestions target answer content and structure only (e.g. "add the concrete example you mentioned earlier").`;

export default async function handler(req, res) {
  const {
    fullTranscript = [],
    situation = "",
    sessionData = null,
    signalData = null,               // [{ timestamp, signal_type, value }] derived client-side — never raw video
    userSelectedCategories = [],     // signal categories the user opted in to see
  } = req.body;

  const personas = sessionData?.personas || [];
  const mode = sessionData?.mode || "interview";
  const userTurns = fullTranscript.filter(t => t.speaker === "You" || t.speaker === "User");

  const transcriptText = fullTranscript
    .map(t => `${t.speaker}: ${t.text}`)
    .join("\n");

  // ── Conversation mode: lightweight optional recap, deliberately low-stakes ──
  if (mode === "conversation") {
    let recap = "You had a conversation practice session. Your full transcript is below.";
    if (userTurns.length > 0) {
      try {
        const raw = await callLLM({
          systemPrompt: `You write a short, warm recap of a casual conversation-practice session. 2-3 sentences: what you chatted about and one genuine, friendly note about the conversation. Never a score, grade, or evaluation. Never mention pauses, pacing, or speech patterns. Return ONLY: {"recap":"..."}`,
          userPrompt: `Transcript:\n${transcriptText.slice(0, 4000)}`,
          maxTokens: 160,
        });
        const parsed = parseJSON(raw);
        if (parsed?.recap) recap = parsed.recap;
      } catch (e) {
        console.error("[debrief] conversation recap failed:", e.message);
      }
    }
    return res.json({
      mode: "conversation",
      transcript: transcriptText,
      persona_impressions: [{ persona: personas[0]?.name || "Your conversation partner", impression: recap }],
      signal_summary: signalData ? summarizeSignals(signalData, fullTranscript) : {},
      user_selected_categories: Array.isArray(userSelectedCategories) ? userSelectedCategories : [],
      session_facts: null,
    });
  }

  // ── Per-persona impressions (LLM, constructive, non-scored) ────────────────
  let impressions = [];
  if (userTurns.length > 0 && personas.length > 0) {
    try {
      const personaList = personas
        .map(p => `- ${p.name} (${p.role}) — style: ${p.style}`)
        .join("\n");
      const raw = await callLLM({
        systemPrompt: IMPRESSIONS_PROMPT,
        userPrompt: `Interview context: "${situation.slice(0, 200)}"
Panel (all fictional):
${personaList}

Transcript:
${transcriptText.slice(0, 6000)}

Write one impression per panel member. JSON now.`,
        maxTokens: 900,
      });
      const parsed = parseJSON(raw);
      if (parsed?.impressions?.length) {
        impressions = parsed.impressions
          .filter(i => i?.persona && i?.impression)
          .slice(0, personas.length);
      }
    } catch (e) {
      console.error("[debrief] impressions failed:", e.message);
    }
  }
  if (!impressions.length && personas.length) {
    impressions = [{
      persona: personas[0].name,
      impression: "Thanks for practicing with us today. A written impression couldn't be generated for this session, but your full transcript is below — re-reading your own answers is one of the most useful ways to review.",
    }];
  }

  // ── Neutral signal summaries (only if tracking data was shared) ─────────────
  const signalSummary = signalData ? summarizeSignals(signalData, fullTranscript) : {};

  // ── Conversation facts (neutral, descriptive — not graded) ─────────────────
  const questionsAsked = fullTranscript.filter(t => t.speaker !== "You" && t.speaker !== "User").length;

  res.json({
    mode: "interview",
    transcript: transcriptText,
    persona_impressions: impressions,
    signal_summary: signalSummary,
    user_selected_categories: Array.isArray(userSelectedCategories) ? userSelectedCategories : [],
    session_facts: {
      questions_asked: questionsAsked,
      answers_given: userTurns.length,
      personas: personas.map(p => ({ name: p.name, role: p.role, color: p.color })),
    },
  });
}
