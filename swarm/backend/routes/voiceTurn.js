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

    writeChunk({
      persona: result.nextPersona,
      voiceId: result.voiceId,
      voiceSettings: result.voiceSettings || null,
      question: result.question || null,
      chunk: result.line,
      done: true,
      sessionComplete: result.sessionComplete || false,
      sessionAdvancing: result.sessionAdvancing || false,
      userPerformanceNote: result.userPerformanceNote || "",
      intent: result.intent || "",
    });

  } catch (err) {
    console.error("voiceTurn error:", err);
    // Send a graceful fallback line instead of leaving session in undefined state
    writeChunk({
      persona: "Panel",
      voiceId: null,
      chunk: "That's interesting — can you tell me more?",
      done: true,
      sessionComplete: false,
      sessionAdvancing: false,
      userPerformanceNote: "",
      intent: "Error recovery",
    });
  } finally {
    res.end();
  }
}
