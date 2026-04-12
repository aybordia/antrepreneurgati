import { runResearcher } from "../agents/researcher.js";
import { runProfiler } from "../agents/profiler.js";
import { runWeakSpotFinder } from "../agents/weakSpotFinder.js";
import { runVoiceDesigner } from "../agents/voiceDesigner.js";
import { runArchitect } from "../agents/architect.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const writeChunk = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const { situation } = req.body;
  if (!situation) {
    writeChunk({ error: "situation is required" });
    return res.end();
  }

  try {
    // Run agents sequentially to avoid rate limits
    const researcherOutput = await runResearcher({ situation }, writeChunk);
    const profilerOutput   = await runProfiler({ situation }, writeChunk);
    const weakSpotOutput   = await runWeakSpotFinder({ situation }, writeChunk);
    const voiceDesignerOutput = await runVoiceDesigner({ situation, profilerOutput }, writeChunk);

    await runArchitect({
      situation,
      researcherOutput,
      profilerOutput,
      weakSpotOutput,
      voiceDesignerOutput,
    }, writeChunk);

  } catch (err) {
    console.error("startSession error:", err);
    writeChunk({ error: err.message });
  } finally {
    res.end();
  }
}
