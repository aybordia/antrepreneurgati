import { runJudgeOrchestrator } from "../agents/judgeOrchestrator.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.socket?.setNoDelay(true);

  const writeChunk = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === "function") res.flush();
  };

  const { transcript, sessionContext, history, currentQuestionIndex } = req.body;

  try {
    const result = await runJudgeOrchestrator({
      transcript: transcript || "",
      sessionContext,
      history: history || [],
      currentQuestionIndex: currentQuestionIndex || 0,
    });

    // Send the full line in one chunk (audio can't play until full text arrives anyway)
    writeChunk({
      persona: result.nextPersona,
      voiceId: result.voiceId,
      chunk: result.line,
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
