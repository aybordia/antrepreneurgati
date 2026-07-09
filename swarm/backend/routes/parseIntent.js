import { parseIntent } from "../agents/intentParser.js";

export default async function handler(req, res) {
  const { transcript, priorIntent, clarifyingAnswer } = req.body;
  if (!transcript?.trim()) {
    return res.status(400).json({ error: "transcript is required" });
  }
  try {
    const intent = await parseIntent({ transcript, priorIntent, clarifyingAnswer });
    res.json({ intent });
  } catch (err) {
    console.error("parseIntent error:", err.message);
    // Never block session creation on intent parsing — fall back to defaults
    res.json({
      intent: {
        institution: null, program_type: null, timeframe_days: null,
        num_interviewers: 3, domain: "general", domain_confident: true, clarifying_question: null,
      },
    });
  }
}
