import { runResearcher } from "../agents/researcher.js";
import { runProfiler } from "../agents/profiler.js";
import { runWeakSpotFinder } from "../agents/weakSpotFinder.js";
import { runVoiceDesigner } from "../agents/voiceDesigner.js";
import { runArchitect } from "../agents/architect.js";
import { getPrefs, buildInterviewStyleHint } from "../lib/prefsStore.js";

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

  // Send heartbeat immediately so the frontend knows the connection is open
  writeChunk({ heartbeat: true });

  const { situation } = req.body;
  if (!situation) {
    writeChunk({ error: "situation is required" });
    return res.end();
  }

  // Load user preferences to personalise this session
  const userId = req.user?.sub;
  const userPrefs = userId ? getPrefs(userId) : null;
  const styleHint = buildInterviewStyleHint(userPrefs);
  if (styleHint) console.log(`[startSession] injecting style prefs for user=${userId} (${userPrefs.sessionCount} sessions)`);

  // Keepalive: send a heartbeat every 8s so Render's proxy never kills
  // the SSE connection during rate-limit waits between agent LLM calls
  const keepalive = setInterval(() => writeChunk({ heartbeat: true }), 8000);

  try {
    // Agents run sequentially; callLLM enforces pacing globally
    const researcherOutput    = await runResearcher({ situation }, writeChunk);
    const profilerOutput      = await runProfiler({ situation }, writeChunk);
    const weakSpotOutput      = await runWeakSpotFinder({ situation }, writeChunk);
    const voiceDesignerOutput = await runVoiceDesigner({ situation, profilerOutput }, writeChunk);

    // Distil the most useful research for the live session judge
    const researchContext = {
      interviewerPatterns: researcherOutput.interviewerPatterns  || "",
      successPatterns:     researcherOutput.successPatterns      || "",
      redFlags:            researcherOutput.redFlags             || [],
      keyFindings:         (researcherOutput.keyFindings || []).slice(0, 4).map(f => f.insight || f),
      rawSummary:          researcherOutput.rawSummary           || "",
      psychologicalProfile: profilerOutput.psychologicalProfile  || "",
      pushbackStyle:        profilerOutput.pushbackStyle         || "",
      personaType:          profilerOutput.personaType           || "",
      diagnosedWeakness:    weakSpotOutput.diagnosedWeakness     || "",
      failureMechanism:     weakSpotOutput.failureMechanism      || "",
      recoveryMove:         weakSpotOutput.recoveryMove          || "",
      warningSignals:       weakSpotOutput.warningSignals        || [],
    };

    await runArchitect({
      situation,
      researcherOutput,
      profilerOutput,
      weakSpotOutput,
      voiceDesignerOutput,
      styleHint,
      researchContext,
    }, writeChunk);

  } catch (err) {
    console.error("startSession error:", err);
    writeChunk({ error: err.message });
  } finally {
    clearInterval(keepalive);
    res.end();
  }
}
