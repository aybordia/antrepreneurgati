# SWARM — Risk Register
> Version: 1.0 | This document is the adversarial view of the project. Every risk listed here has happened to a real team at a real hackathon. Read this before you build and again before the demo.

---

## Risk Assessment Summary

| # | Risk | Category | Likelihood | Impact | Overall |
|---|---|---|---|---|---|
| 1 | ElevenLabs latency makes session feel broken | Technical | High | High | 🔴 Critical |
| 2 | WebSpeech API not supported in demo browser | Technical | Medium | High | 🟠 High |
| 3 | Claude API rate limits during Phase 2 | Technical | Medium | High | 🟠 High |
| 4 | 3D performance kills frame rate on hackathon hardware | Technical | High | Medium | 🟠 High |
| 5 | Tavily returns irrelevant results | Technical | Medium | Medium | 🟡 Medium |
| 6 | Judge doesn't understand the product in 3 min | Product | High | High | 🔴 Critical |
| 7 | Agent JSON parse failures under pressure | Technical | Medium | High | 🟠 High |
| 8 | Streaming breaks in production (Railway/Vercel) | Technical | Medium | High | 🟠 High |
| 9 | ElevenLabs API is down during demo | External | Low-Medium | High | 🟠 High |
| 10 | Session context grows too large for Claude API | Technical | Medium | Medium | 🟡 Medium |

---

## Risk 1 — ElevenLabs Latency Makes the Session Feel Broken

**Category:** Technical  
**Likelihood:** High  
**Impact:** High — the voice session is the central demo moment. If there's a 3–5 second gap of silence between the user finishing a sentence and the AI responding, the session feels like a broken chatbot, not a practice panel.

### What Goes Wrong

ElevenLabs `eleven_turbo_v2` has a typical response time of 800ms–2.5s. But this is just the API call. The total latency for one turn includes:
- WebSpeech silence detection threshold: ~2000ms after user stops speaking
- `/api/voice-turn` Claude call: ~1.5–3s
- ElevenLabs TTS generation: ~800ms–2.5s
- Audio blob URL creation + `audio.play()` start: ~100ms

**Total per-turn latency:** 4–8 seconds. In a real panel session, that's uncomfortably long.

### Mitigations

**Mitigation 1 — Reduce silence threshold:** Change `silenceThresholdMs` from 2000ms to 1200ms. The cost is occasional false-positive silence detection, but the session feels tighter.

**Mitigation 2 — Fire ElevenLabs early:** Don't wait for `done: true` from the streaming voice-turn response. Listen for the first complete sentence (detect `.` or `?` followed by space), immediately call ElevenLabs with that sentence while the rest of the line continues streaming. Chain audio segments for the rest of the response.

```javascript
// Sentence-level streaming audio
let pendingSentences = [];
let isPlaying = false;

function onVoiceTurnChunk(chunk) {
  lineBuffer += chunk;
  const sentenceEnd = lineBuffer.search(/[.!?]\s/);
  if (sentenceEnd > 0 && !isPlaying) {
    const sentence = lineBuffer.slice(0, sentenceEnd + 1);
    lineBuffer = lineBuffer.slice(sentenceEnd + 2);
    queueSpeech(sentence, voiceId);
  }
}

async function queueSpeech(text, voiceId) {
  isPlaying = true;
  const audio = await speakText({ text, voiceId });
  audio.onended = () => {
    isPlaying = false;
    if (pendingSentences.length > 0) {
      queueSpeech(pendingSentences.shift(), voiceId);
    }
  };
  audio.play();
}
```

**Mitigation 3 — Use a visual state:** Show an animated "thinking" indicator on the orb between when the user stops speaking and when the AI responds. This reframes latency as "the AI is processing" rather than "something broke."

**Mitigation 4 — Cache repeat phrases:** Common session lines like "Tell me more about that" or "Interesting — can you elaborate?" can be pre-generated and cached at session start. If the Judge Orchestrator routes to a follow-up, play the cached audio immediately.

---

## Risk 2 — WebSpeech API Not Supported in Demo Browser

**Category:** Technical  
**Likelihood:** Medium (High if demo browser is Firefox)  
**Impact:** High — if voice input doesn't work, Phase 3 is unusable

### What Goes Wrong

WebSpeech API is supported in:
- ✅ Chrome 33+
- ✅ Edge 79+
- ✅ Safari 14.1+
- ❌ Firefox (not supported as of 2026)

If the demo machine defaults to Firefox, or if a judge opens the URL in Firefox on their phone, voice input is completely broken. There is no polyfill.

Additionally, WebSpeech requires:
- HTTPS or localhost (no HTTP in production)
- Microphone permission (already granted — handle in pre-demo setup)
- The page must be in the foreground (background tabs stop recognition)

### Mitigations

**Mitigation 1 — Browser detection on load:** Show a persistent banner if not Chrome/Edge:
```javascript
const isSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
if (!isSupported) {
  showBanner("Voice input requires Chrome or Edge. Text input is available below.");
}
```

**Mitigation 2 — Graceful text-only fallback:** Never disable the text input field in Voice Session. If WebSpeech isn't working, the user can type their responses. The Judge Orchestrator doesn't care whether the input came from voice or typing. Label the text input "Type your response" as a fallback.

**Mitigation 3 — Demo machine pre-check:** Before the demo slot, run through the full flow on the exact machine and browser that will be used. Don't assume — verify.

**Mitigation 4 — Bring a backup device:** Have a second laptop or a phone (iOS Safari or Android Chrome) that has been tested and confirmed to work.

---

## Risk 3 — Claude API Rate Limits Hit During Phase 2

**Category:** Technical  
**Likelihood:** Medium  
**Impact:** High — Phase 2 fires 4–5 simultaneous Claude calls. If rate limits are hit, some agents will fail or slow significantly, breaking the research swarm visual.

### What Goes Wrong

The standard Anthropic API tier allows 50 requests/minute and 200k input tokens/minute for `claude-sonnet-4-5`. Under normal conditions, 5 simultaneous calls is fine. However:
- If multiple team members are testing simultaneously (common at end of build)
- If Claude API is globally busy (common at hackathon events where many teams use the same API)
- If context sizes grow large (long conversation histories)

The result is a 529 "overloaded" error or a 429 "too many requests" error. One or more agents fail silently.

### Mitigations

**Mitigation 1 — Retry with backoff:** In `claude.js`, wrap all calls with one retry on 529:
```javascript
try {
  return await client.messages.stream(...);
} catch (err) {
  if (err.status === 529 || err.status === 429) {
    await new Promise(r => setTimeout(r, 2500));
    return await client.messages.stream(...); // one retry
  }
  throw err;
}
```

**Mitigation 2 — Stagger agent starts slightly:** Instead of true simultaneous `Promise.all`, add a small stagger:
```javascript
const [r, p, w, v] = await Promise.all([
  runResearcher(situation, writeChunk),
  delay(200).then(() => runProfiler(situation, writeChunk)),
  delay(400).then(() => runWeakSpotFinder(situation, writeChunk)),
  delay(600).then(() => runVoiceDesigner(situation, writeChunk)),
]);
```
200–600ms stagger doesn't affect perceived speed but prevents a simultaneous spike.

**Mitigation 3 — Reduce token counts:** If hitting limits, reduce `maxTokens` per agent from 1200 to 800. Output will be slightly shorter but still useful.

**Mitigation 4 — Fallback to `claude-haiku-3-5`:** Haiku is faster and cheaper — under high load, Sonnet may be throttled while Haiku still responds. Have a `model` override available: `const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-5"`.

---

## Risk 4 — 3D Visualizations Kill Frame Rate on Hackathon Hardware

**Category:** Technical  
**Likelihood:** High — hackathon laptops are often old school-issued machines or cheap Windows laptops with integrated graphics  
**Impact:** Medium — the app still works, it just looks bad and may feel sluggish

### What Goes Wrong

Three.js with 1200 particles + 5 animated orbs with glows + particle beams + audio waveform ring can easily push 60fps performance requirements on a dedicated GPU machine to 15fps on integrated Intel graphics. The app becomes visually choppy and the 3D "wow factor" disappears.

### Mitigations

**Mitigation 1 — Adaptive particle count:** On init, render a test frame and check frame time. If > 33ms, switch to reduced mode:
```javascript
// In ParticleField.jsx
const PARTICLE_COUNT = window.devicePixelRatio > 1 || window.innerWidth > 1440 ? 1200 : 400;
```

Use `navigator.hardwareConcurrency` as a proxy: if ≤ 4 cores, assume lower-end hardware and reduce to 400 particles.

**Mitigation 2 — Disable particle beams on low-end:** The particle beam effect from each active orb is the most expensive 3D element. Gate it:
```javascript
const ENABLE_PARTICLE_BEAMS = navigator.hardwareConcurrency > 4;
```

**Mitigation 3 — Reduce orb geometry complexity:** Default `SphereGeometry(0.3, 32, 32)` has 32 segments. On low-end hardware: `SphereGeometry(0.3, 16, 16)`. Difference is invisible at orb scale but halves vertex count.

**Mitigation 4 — CSS fallback for ConfidenceTerrain:** The terrain is the most computationally expensive 3D element. Have a 2D fallback ready: a horizontal bar chart using divs where height = confidence score. Activate if `isLowEndDevice` flag is set.

**Mitigation 5 — Demo on a known-good machine:** If possible, bring your own laptop that has been tested. Don't rely on hackathon-provided hardware for the demo.

---

## Risk 5 — Tavily Returns Irrelevant Results

**Category:** Technical  
**Likelihood:** Medium  
**Impact:** Medium — Researcher output becomes generic. Differentiating "live research" claim is weakened.

### What Goes Wrong

Tavily search is only as good as the query. For niche situations ("My startup's Series A pitch to a specific micro-VC"), Tavily may return generic blog posts about "how to pitch VCs" rather than specific firsthand accounts.

The Researcher agent may then produce outputs that sound like generic advice, undermining the product's core promise.

### Mitigations

**Mitigation 1 — Two-query approach:** Run two Tavily searches per session. Query 1 is high-specificity (institution + role + year + "Reddit OR firsthand"). Query 2 is broader (context type + "tips" + "what to expect"). Combine results — specific findings take priority in the prompt.

**Mitigation 2 — Result quality check:** Before passing results to Claude, check if any result has a relevance `score` > 0.7 (Tavily returns scores). If all results are < 0.7, log a warning and add to the prompt: `"The search results for this specific context were limited. Clearly label which insights are research-backed and which are inference."`

**Mitigation 3 — Fallback to Claude knowledge:** If Tavily fails completely or returns 0 relevant results (all scores < 0.4), set `formattedResults` to empty and instruct the Researcher to use training data explicitly, clearly marked as inference.

**Mitigation 4 — Hardcoded demo situation:** For the live demo, use the pre-tested hackathon pitch situation. This has been verified to return good Tavily results about hackathon pitching, technical architecture defense, and Silicon Valley judge dynamics.

---

## Risk 6 — Judge Doesn't Understand the Product in 3 Minutes

**Category:** Product  
**Likelihood:** High — this is the most common failure at hackathons  
**Impact:** High — a product that doesn't land in the pitch can lose to technically inferior products that are presented better

### What Goes Wrong

Judges at hackathon events hear 20–40 pitches in a day. Attention is fractured. The failure mode is not that they don't understand the technology — it's that they don't understand *why it matters* in the first 15 seconds.

Common misunderstandings:
- "This is just ChatGPT with voice" (misses the agent architecture + live research angle)
- "This is like interview prep apps I've seen" (misses the dynamic vs. static distinction)
- "Cool demo but what's the business here?" (fine — focus on the product, not the pitch)

### Mitigations

**Mitigation 1 — The opening line must be a specific scenario, not a product description:**  
BAD: "Swarm is an AI-powered multi-agent interview preparation tool that uses live web research..."  
GOOD: "You have an MIT interview in two days. Right now, every prep tool gives you the same generic fake interviewer. We built a system that goes online, researches what MIT interviewers have actually asked in 2025, builds a custom panel for your exact gap, and puts you in a live spoken practice with distinct AI personas. Watch."

**Mitigation 2 — Show the live demo immediately (within 30 seconds of pitch start):**  
Don't explain the architecture before showing the product. Feed the hackathon pitch situation into Swarm on stage. Let the judges see the swarm researching their own event. This is the moment the product sells itself.

**Mitigation 3 — The killer line:**  
End the demo with: "Every other tool gave the judges the same fake interviewer as everyone else. We gave ourselves a panel built from live research about this exact event, with the exact type of judges sitting in front of us right now."  
This makes the differentiation visceral and personal for the judges.

**Mitigation 4 — Prepare for the "why not just ChatGPT" question:**  
Pre-answer in the pitch: "ChatGPT is one voice, no research, no multi-agent coordination, no debrief. We're an orchestrated system — five agents working together, live web data, distinct ElevenLabs voices per persona, a judge orchestrator routing the session. That's not a prompt, it's an architecture."

**Mitigation 5 — Have one sentence per prize track:**  
- Best Use of ElevenLabs: "Every interviewer persona has a unique ElevenLabs voice — warmth, pace, and pushback style engineered to match the archetype."
- Best Use of Gen AI: "Five Claude agents run in parallel, each with a distinct system prompt and role. A sixth orchestrates the live session. A seventh analyzes your performance."
- Best .Tech Domain: "We're live at swarm.tech."

---

## Risk 7 — Agent JSON Parse Failures Under Demo Pressure

**Category:** Technical  
**Likelihood:** Medium  
**Impact:** High — a JSON parse failure cascades: if Profiler output fails to parse, VoiceDesigner has no personas to spec, Architect has no profiles to work with. The whole pipeline breaks.

### What Goes Wrong

Claude occasionally returns:
- JSON with a trailing comma (invalid)
- JSON wrapped in markdown code fences (\`\`\`json ... \`\`\`)
- A partial JSON object (truncated by `maxTokens`)
- A preamble sentence before the JSON: "Here is the output:" followed by JSON
- Non-JSON entirely if the model "decides" to explain something

### Mitigations

**Mitigation 1 — Robust JSON extraction wrapper:**
```javascript
function extractJSON(rawText) {
  // Remove markdown code fences
  let cleaned = rawText.replace(/```json\n?/g, "").replace(/\n?```/g, "").trim();
  
  // Find first { to last } (handles preamble text)
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  
  cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}
```

Apply `extractJSON()` to every agent output instead of bare `JSON.parse()`.

**Mitigation 2 — Retry on parse failure:**
```javascript
async function runAgentWithRetry(agentFn, ...args) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await agentFn(...args);
    } catch (err) {
      if (attempt === 0 && err.message.includes("JSON")) {
        console.warn(`JSON parse failed for agent, retrying...`);
        continue;
      }
      throw err;
    }
  }
}
```

**Mitigation 3 — Partial failure graceful degradation:** If one agent fails after retry, continue with the others. The Architect prompt includes fallback instructions: if a prior agent's output is missing, use reasonable defaults based on the situation alone. The session may be slightly less tailored, but it still runs.

**Mitigation 4 — Increase `maxTokens` for Architect:** Architect output is the largest JSON object. Set its `maxTokens` to 2500. Truncation (mid-JSON output cut off) is the most common cause of parse failures.

---

## Risk 8 — Streaming Breaks in Production (Railway/Vercel)

**Category:** Technical  
**Likelihood:** Medium  
**Impact:** High — streaming is the core visual of Phase 2. If it breaks in production (works locally but not on Railway), the swarm just shows a loading spinner.

### What Goes Wrong

Railway uses Nginx as a reverse proxy. Nginx buffers responses by default. This means SSE streaming chunks are buffered until the buffer fills or the connection closes — the frontend receives all data at once at the end instead of in real-time.

### Mitigations

**Mitigation 1 — Add the Nginx buffering disable header:**
```javascript
// In every streaming route handler, before res.flushHeaders()
res.setHeader("X-Accel-Buffering", "no");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
```

**Mitigation 2 — Test on Railway before the hackathon ends:** Explicitly run the full Phase 2 flow on the Railway-deployed backend after deployment. Don't assume local behavior matches production.

**Mitigation 3 — Add a keepalive ping:** Send an empty SSE comment every 15 seconds to prevent the connection from being closed by proxy timeouts:
```javascript
const keepAlive = setInterval(() => {
  if (!res.writableEnded) res.write(": keepalive\n\n");
}, 15000);
// Clear it in the finally block
```

**Mitigation 4 — Vercel CORS:** Vercel adds its own headers. Ensure the Railway backend's `allowedOrigins` includes the exact Vercel production URL (not just the preview URL pattern).

---

## Risk 9 — ElevenLabs API Is Down During Demo

**Category:** External  
**Likelihood:** Low-Medium (ElevenLabs has had service disruptions in 2024–2025)  
**Impact:** High — the distinct voice personas are the primary ElevenLabs prize differentiator

### What Goes Wrong

ElevenLabs service goes down or becomes severely degraded (5+ second response times) during the demo window.

### Mitigations

**Mitigation 1 — Pre-generate audio for the demo session:** Before the demo, run the hackathon pitch situation through the full flow once. Capture the ElevenLabs audio for the opening question, key follow-up questions, and debrief. Cache these as MP3 files in `/public/audio/`.

If ElevenLabs is down during the live demo, play the cached audio for those specific lines. The session will feel slightly less adaptive but the voices will still sound real.

**Mitigation 2 — Browser `speechSynthesis` fallback:** Auto-detect ElevenLabs failure and switch (see TESTING.md). Show a subtle banner. This preserves the voice session flow even if voices sound robotic.

**Mitigation 3 — Status monitoring:** Before the demo slot, check https://status.elevenlabs.io. If there's an active incident, immediately activate the cached audio plan.

---

## Risk 10 — Session Context Grows Too Large for Claude API

**Category:** Technical  
**Likelihood:** Medium  
**Impact:** Medium — sessions that run long (10+ turns) will start exceeding input token budgets

### What Goes Wrong

The `/api/voice-turn` endpoint sends:
- Full session context (situation + all 5 agent outputs): ~3000 tokens
- Conversation history (each turn ~50 tokens): grows by 50 tokens/turn
- At turn 15, history alone is 750 tokens. At turn 30, it's 1500 tokens.

With a 200k token context window, this isn't a true limit issue — but it increases latency and cost per turn significantly.

### Mitigations

**Mitigation 1 — Truncate conversation history:** Only send the last 10 turns to the Judge Orchestrator:
```javascript
const recentHistory = history.slice(-10);
```

The Judge Orchestrator has the session plan (question order) to maintain continuity — it doesn't need full history.

**Mitigation 2 — Summarize agent research on injection:** Instead of injecting all 5 full agent outputs (~5000 tokens) into every voice-turn call, pre-summarize them into a 500-token "session brief" at the start of the session. Use this brief for all voice-turn calls instead of the full outputs.

**Mitigation 3 — Store session context server-side:** Keep the session context in memory on the backend keyed by a session ID. The frontend sends only `{ sessionId, transcript, history }`. The backend retrieves the full context. This reduces request body size and latency for large sessions.

---

## Risk Summary — Pre-Demo Checklist

Before walking onto the stage, verify:

- [ ] ElevenLabs API status: https://status.elevenlabs.io — no active incidents
- [ ] Anthropic API status: https://status.anthropic.com — no active incidents  
- [ ] Tavily API status: check dashboard or test query manually
- [ ] Chrome is open and microphone permission is already granted
- [ ] Demo URL opens without errors
- [ ] Streaming test: run Phase 2 with any situation — all 5 agents complete
- [ ] Voice test: Phase 3 with 2 turns — at least 1 ElevenLabs voice heard
- [ ] Audio output: speakers/headphones connected and working
- [ ] Backup demo video: downloaded locally, not just cloud link
- [ ] Phase 2 latency: under 25 seconds on current network
- [ ] Internet connection: tested, not relying on hackathon WiFi for API calls (use phone hotspot as backup)
- [ ] `git status` is clean — no uncommitted changes that could break the deployment
