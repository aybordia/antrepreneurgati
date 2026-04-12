import { callLLM } from "../lib/llm.js";

export default async function handler(req, res) {
  const { question, sessionSnapshot } = req.body;

  try {
    const systemPrompt = `You are a session analysis assistant for Swarm. The user is asking a question about their past practice session. Answer concisely and specifically based only on the session data provided. Do not fabricate details not present in the transcript.`;

    const userPrompt = `Session situation: "${sessionSnapshot.situation}"

Session transcript:
${sessionSnapshot.conversationHistory?.map((t) => `[${t.speaker}]: ${t.text}`).join("\n") || "No transcript available"}

Debrief summary:
${sessionSnapshot.debrief ? `Clarity score: ${sessionSnapshot.debrief.clarityScore}. ${sessionSnapshot.debrief.overallVerdict}` : "No debrief available"}

User's question: "${question}"

Answer the question based on this session data.`;

    const answer = await callLLM({ systemPrompt, userPrompt, maxTokens: 400 });
    res.json({ answer });
  } catch (err) {
    console.error("querySession error:", err);
    res.status(500).json({ error: err.message });
  }
}
