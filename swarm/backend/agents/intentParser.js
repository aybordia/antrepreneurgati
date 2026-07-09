// PROMPT VERSION: 1.0 — spoken request → structured session intent
import { callLLM, parseJSON } from "../lib/llm.js";

export const DOMAINS = ["cs", "engineering", "bio", "medical", "business", "humanities", "general"];

const SYSTEM_PROMPT = `You extract structured interview-prep intent from a spoken request.
Return ONLY valid JSON, no markdown:
{"institution":"string or null","program_type":"medical|graduate|undergraduate|job|internship|residency|other or null","timeframe_days":number or null,"num_interviewers":number or null,"domain":"${DOMAINS.join("|")}" or null,"domain_confident":true/false,"clarifying_question":"string or null"}

Rules:
- institution: the university/company/organization named, exactly as spoken (e.g. "Stanford", "Google"). null if none.
- timeframe_days: convert phrases ("in 2 days"→2, "next week"→7, "tomorrow"→1). null if unstated.
- num_interviewers: explicit count if stated ("4 professors"→4). null if unstated.
- domain: the subject area of likely technical questions. Map: software/programming→cs, mechanical/electrical/hardware→engineering, biology/pre-med research→bio, medical school/clinical/residency→medical, MBA/finance/consulting/sales→business, history/English/arts/law→humanities. Use "general" only when the interview clearly has no technical subject.
- domain_confident: false when the domain is a guess or genuinely unclear from the words spoken. Example: "Stanford interview with 4 professors" — program unknown → domain_confident false.
- clarifying_question: when domain_confident is false, ONE short, concrete, literal spoken question to resolve it (e.g. "What subject or program is this interview for — for example computer science, medicine, or business?"). Direct wording, no idioms. null when confident.`;

const DEFAULTS = { institution: null, program_type: null, timeframe_days: null, num_interviewers: 3, domain: "general", domain_confident: false, clarifying_question: null };

export async function parseIntent({ transcript, priorIntent = null, clarifyingAnswer = null }) {
  const userPrompt = clarifyingAnswer
    ? `Original request: "${transcript}"
Previously parsed: ${JSON.stringify(priorIntent)}
They were asked to clarify the domain and answered: "${clarifyingAnswer}"
Re-output the full JSON with the domain resolved (domain_confident true, clarifying_question null).`
    : `Spoken request: "${transcript}"`;

  const raw = await callLLM({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 220 });
  const parsed = parseJSON(raw);
  if (!parsed) return { ...DEFAULTS, domain_confident: true }; // unparseable → proceed with defaults, don't loop on clarification

  const intent = { ...DEFAULTS, ...parsed };
  if (!DOMAINS.includes(intent.domain)) intent.domain = "general";
  intent.num_interviewers = Math.min(Math.max(Number(intent.num_interviewers) || 3, 1), 5);
  intent.timeframe_days = Number.isFinite(Number(intent.timeframe_days)) && intent.timeframe_days !== null
    ? Number(intent.timeframe_days) : null;
  // Only ever ask ONE clarifying question — after an answer, force-resolve
  if (clarifyingAnswer) { intent.domain_confident = true; intent.clarifying_question = null; }
  if (intent.domain_confident) intent.clarifying_question = null;
  return intent;
}
