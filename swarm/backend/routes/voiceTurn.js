import { runJudgeOrchestrator } from "../agents/judgeOrchestrator.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const writeChunk = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const { transcript, sessionContext, history, currentQuestionIndex } = req.body;

  try {
    const result = await runJudgeOrchestrator({
      transcript: transcript || "",
      sessionContext,
      history: history || [],
      currentQuestionIndex: currentQuestionIndex || 0,
    });

    // Stream the persona's line character by character
    for (const char of result.line) {
      writeChunk({ persona: result.nextPersona, voiceId: result.voiceId, chunk: char, done: false });
      await new Promise((r) => setTimeout(r, 15));
    }

    writeChunk({
      persona: result.nextPersona,
      voiceId: result.voiceId,
      chunk: "",
      done: true,
      sessionComplete: result.sessionComplete,
      sessionAdvancing: result.sessionAdvancing,
      userPerformanceNote: result.userPerformanceNote,
      intent: result.intent,
    });

  } catch (err) {
    console.error("voiceTurn error:", err);
    writeChunk({ error: err.message });
  } finally {
    res.end();
  }
}
