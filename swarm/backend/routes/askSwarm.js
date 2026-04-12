import { callLLM } from "../lib/llm.js";

const SYSTEM_PROMPT = `You are Swarm AI, a brutally honest interview coach who just watched the user's full practice session. You have:
- The full verbatim transcript of every question asked and every answer the user gave
- The debrief analysis (scores, best/worst moments, content gaps, priority fix)
- The session context (what they were preparing for, the personas who interviewed them)

Your job: answer the user's questions about their interview with specific, direct, evidence-based responses. Always cite what they actually said when relevant — quote their exact words from the transcript. Never be vague. If they ask "how did I do on X", pull the specific moment from the transcript and tell them exactly what was strong or weak about it.

Tone: direct, warm, coach-like. No fluff. No "great question!" openers. Just the answer.`;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const writeChunk = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const { question, interviewTranscript, situation, debrief, sessionData, chatHistory = [] } = req.body;

  if (!question?.trim()) {
    writeChunk({ error: "question is required" });
    return res.end();
  }

  try {
    const contextBlock = `
SITUATION THE USER WAS PREPARING FOR:
"${situation}"

FULL INTERVIEW TRANSCRIPT:
${(interviewTranscript || []).map(t => `${t.speaker}: ${t.text}`).join("\n")}

DEBRIEF ANALYSIS:
- Clarity Score: ${debrief?.clarityScore ?? "N/A"}/100
- Rationale: ${debrief?.clarityRationale ?? ""}
- Best Moment: ${debrief?.bestMoment?.quote ? `"${debrief.bestMoment.quote}" — ${debrief.bestMoment.reason}` : "none recorded"}
- Worst Moment: ${debrief?.worstMoment?.quote ? `"${debrief.worstMoment.quote}" — ${debrief.worstMoment.reason}` : "none recorded"}
- Content Gaps: ${(debrief?.contentGaps || []).map(g => g.gap).join("; ") || "none"}
- Priority Fix: ${debrief?.priorityFix ?? ""}
- Overall Verdict: ${debrief?.overallVerdict ?? ""}

SESSION PLAN:
${sessionData?.sessionPlan ? JSON.stringify(sessionData.sessionPlan, null, 2) : "not available"}
`.trim();

    const priorChat = chatHistory.map(m =>
      `${m.role === "user" ? "User" : "Swarm AI"}: ${m.content}`
    ).join("\n");

    const userPrompt = `${contextBlock}

${priorChat ? `PRIOR CONVERSATION:\n${priorChat}\n` : ""}
USER'S QUESTION:
${question}`;

    const answer = await callLLM({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 800,
    });

    // Stream character by character for typewriter effect
    for (const char of answer) {
      writeChunk({ chunk: char, done: false });
    }
    writeChunk({ chunk: "", done: true });

  } catch (err) {
    console.error("askSwarm error:", err);
    writeChunk({ error: err.message });
  } finally {
    res.end();
  }
}
