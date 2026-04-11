# SWARM — Build Sequence
> Version: 1.0 | This is the exact build order for a 24-hour hackathon. Each step must be completed and verified before the next begins. Time estimates assume two people working in parallel where noted.

---

## Before You Start

Read these rules. They prevent the classic hackathon failure pattern of building a beautiful UI that has no working backend underneath it.

1. **Build backend before frontend.** The frontend is a consumer of the backend. If the backend doesn't work, no amount of frontend polish matters.
2. **Mock before real.** Every step builds a working mock first, then swaps in the real API. This ensures the system is always in a runnable state.
3. **Verify conditions are non-negotiable.** Do not proceed to the next step until the verify condition passes. If it doesn't pass, fix it before moving on.
4. **The demo is always the north star.** If a step takes longer than estimated, cut scope within that step — do not skip the verify condition.
5. **Commit after every step.** `git commit -m "step N complete: [description]"` at the end of each step.

---

## Step 1 — Project Scaffold

**Time estimate:** 30–45 minutes  
**Owner:** Both team members (backend person sets up backend, frontend person sets up frontend simultaneously)

### What to Build

**Backend scaffold:**
```bash
mkdir swarm && cd swarm
mkdir backend && cd backend
npm init -y
npm install @anthropic-ai/sdk cors dotenv express
npm install -D nodemon
```

Set `"type": "module"` in `package.json`. Add scripts:
```json
"scripts": { "start": "node index.js", "dev": "nodemon index.js" }
```

Create `backend/index.js`:
```javascript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.listen(process.env.PORT || 3001, () => console.log("Backend running on :3001"));
```

Create `backend/.env` from `.env.example` with real API keys filled in.

**Frontend scaffold:**
```bash
cd .. && npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install @react-three/fiber @react-three/drei three framer-motion gsap uuid
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Configure `tailwind.config.js` for content: `["./index.html", "./src/**/*.{js,jsx}"]`.

In `src/index.css`, add Tailwind directives and font imports from UI_SPEC.md.

Create `frontend/.env` with `VITE_API_BASE_URL=http://localhost:3001` and `VITE_ELEVENLABS_API_KEY=`.

### Verify Condition

- `cd backend && npm run dev` → terminal shows `Backend running on :3001`
- `curl http://localhost:3001/health` → returns `{"status":"ok","time":"..."}`
- `cd frontend && npm run dev` → browser opens at `http://localhost:5173`
- Browser shows default Vite React page (or a blank page with no errors in console)
- No TypeScript errors, no missing module errors

### If This Step Fails

- Module not found: check `"type": "module"` in backend package.json
- CORS error: not relevant yet (both run locally)
- Vite build error: check Node version ≥ 18 with `node --version`

---

## Step 2 — All 4 Backend Endpoints with Mock Responses

**Time estimate:** 45–60 minutes  
**Owner:** Backend person

### What to Build

Create all 4 route files with mock streaming responses. The frontend should be able to call these and get realistic-looking fake data back. This lets the frontend person build UI against real endpoints immediately.

**`backend/routes/startSession.js` (mock):**
```javascript
export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const writeChunk = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const agents = ["Researcher", "Profiler", "WeakSpotFinder", "VoiceDesigner", "Architect"];
  for (const agent of agents) {
    const mockText = `[MOCK] ${agent} analyzing: "${req.body.situation}"...`;
    for (const char of mockText) {
      writeChunk({ agent, chunk: char, done: false });
      await new Promise(r => setTimeout(r, 20));
    }
    writeChunk({ agent, chunk: "", done: true });
    await new Promise(r => setTimeout(r, 300));
  }
  res.end();
}
```

Do the same for `voiceTurn.js`, `debrief.js`, `querySession.js` — each returns hardcoded mock data in the correct schema from ARCHITECTURE.md.

Mount all routes in `index.js`:
```javascript
import startSession from "./routes/startSession.js";
// etc.
app.post("/api/start-session", startSession);
```

### Verify Condition

Run all 4 endpoints with curl:
```bash
curl -X POST http://localhost:3001/api/start-session \
  -H "Content-Type: application/json" \
  -d '{"situation":"test"}' \
  --no-buffer

curl -X POST http://localhost:3001/api/voice-turn \
  -H "Content-Type: application/json" \
  -d '{"transcript":"hello","sessionContext":"ctx","history":[]}'

curl -X POST http://localhost:3001/api/debrief \
  -H "Content-Type: application/json" \
  -d '{"fullTranscript":[],"situation":"test","agentResearch":{}}'

curl -X POST http://localhost:3001/api/query-session \
  -H "Content-Type: application/json" \
  -d '{"question":"test","sessionSnapshot":{}}'
```

All 4 must return responses matching the schemas in ARCHITECTURE.md (even if mocked).

### If This Step Fails

- Express route 404: check `app.post("/api/...")` mount paths match exactly
- JSON parse error: verify `app.use(express.json())` is in `index.js` before route mounts
- Streaming not working: verify `res.flushHeaders()` before first `res.write()`

---

## Step 3 — API Wrappers with Real Keys

**Time estimate:** 45 minutes  
**Owner:** Backend person  
**Prerequisite:** Step 2 complete

### What to Build

Build `backend/lib/claude.js`, `backend/lib/tavily.js`, and `backend/lib/elevenlabs.js` using the exact implementations in ARCHITECTURE.md.

Then write a quick test script `backend/test-apis.js`:
```javascript
import { callClaude } from "./lib/claude.js";
import { tavilySearch } from "./lib/tavily.js";

// Test Claude
const claudeResult = await callClaude({
  systemPrompt: "You are a helpful assistant. Return JSON.",
  userPrompt: "Return this JSON: {\"test\": true}",
});
console.log("Claude result:", claudeResult);

// Test Tavily
const tavilyResult = await tavilySearch({ query: "MIT admissions interview 2025 Reddit" });
console.log("Tavily result:", JSON.stringify(tavilyResult.slice(0, 2), null, 2));

console.log("All API tests passed.");
```

Run with: `node test-apis.js`

### Verify Condition

- `node test-apis.js` runs without errors
- Claude returns a parseable JSON string
- Tavily returns an array of at least 3 results with `title`, `url`, `snippet` fields
- No 401/403 auth errors

### If This Step Fails

- Claude 401: check `ANTHROPIC_API_KEY` in `.env` — must not have extra spaces or quotes
- Tavily 401: check `TAVILY_API_KEY` — make sure `dotenv.config()` runs before the import
- Module import error: ensure `"type": "module"` in package.json and all imports use `.js` extensions

---

## Step 4 — All 5 Agent System Prompts + Judge Orchestrator

**Time estimate:** 60–90 minutes  
**Owner:** Backend person  
**Prerequisite:** Step 3 complete

### What to Build

Create all 6 agent files in `backend/agents/`. Each file exports a function that takes the situation (and any prior agent output) and returns the agent's structured output.

Each agent file pattern:
```javascript
// backend/agents/profiler.js
import { callClaude } from "../lib/claude.js";
import { PROFILER_SYSTEM_PROMPT } from "../prompts/profiler.js"; // or inline

export async function runProfiler({ situation, extractedGap }) {
  const userPrompt = `The user's situation: "${situation}"\nThe user's specific stated weakness: "${extractedGap}"...`;
  const result = await callClaude({
    systemPrompt: PROFILER_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1200,
  });
  return JSON.parse(result); // throws if not valid JSON
}
```

Use the exact prompts from `PROMPTS.md` — copy them verbatim.

Create a test script `backend/test-agents.js`:
```javascript
const situation = "MIT CS interview in 2 days — I always freeze on why MIT";
const gap = "I always freeze on why MIT";

const researcherOutput = await runResearcher({ situation });
console.log("Researcher:", JSON.stringify(researcherOutput, null, 2));

const profilerOutput = await runProfiler({ situation, extractedGap: gap });
console.log("Profiler:", JSON.stringify(profilerOutput, null, 2));

// etc. for all agents
// Final: run Architect with all 4 outputs
const architectOutput = await runArchitect({
  situation,
  researcherOutput,
  profilerOutput,
  weakSpotOutput,
  voiceDesignerOutput,
});
console.log("Architect:", JSON.stringify(architectOutput, null, 2));
```

### Verify Condition

`node test-agents.js` must:
- Complete without throwing JSON parse errors for any agent
- Researcher output: has `keyFindings` array with ≥5 items, all with `insight`, `source`, `relevance`
- Profiler output: has `interviewerPersonas` array with exactly 3 items
- WeakSpotFinder: has `responseFrameworks` array with exactly 3 items
- VoiceDesigner: has `voiceSpecs` array with 3 items, each with valid `elevenLabsVoiceTarget`
- Architect: has `sessionPlan.questions` array with ≥6 items, `personas` array with exactly 3 items

If any agent returns invalid JSON: re-run once (Claude occasionally fails to close a JSON block). If it fails consistently, check that `maxTokens` is high enough for the output size.

### If This Step Fails

- JSON parse error: add `console.log("Raw output:", result)` before `JSON.parse(result)` to see what Claude actually returned. Common issue: Claude adds markdown code fences around the JSON. Fix with: `result.replace(/```json\n?|\n?```/g, "").trim()`
- Agent returns wrong schema: check that system prompt is copied exactly from PROMPTS.md
- Researcher returns empty `keyFindings`: Tavily query may be returning off-topic results — log `searchQuery` and `formattedTavilyResults` to inspect

---

## Step 5 — Wire Tavily into Researcher, Verify Real Search

**Time estimate:** 30 minutes  
**Owner:** Backend person  
**Prerequisite:** Steps 3 + 4 complete

### What to Build

The `runResearcher` function must do a two-step process:
1. Call Claude to generate the optimal Tavily search query from the situation string
2. Call Tavily with that query
3. Format results
4. Call Claude again with the formatted results to produce the Researcher agent output

The full implementation is already in PROMPTS.md. Wire it in `backend/agents/researcher.js`.

### Verify Condition

Run `node test-agents.js` with situation = `"MIT CS interview in 2 days"`.

Check researcher output `rawSummary` — it must reference MIT-specific content, not generic interview advice. If it says things like "interviewers value intellectual curiosity in general," Tavily is not returning MIT-specific content or Claude is ignoring it.

Log the `searchQuery` that Claude generates and the `formattedTavilyResults`. The query should look like: `"MIT Computer Science undergraduate interview 2025 experience Reddit"`. The results should include recognizable sources (Reddit, College Confidential, etc.).

### If This Step Fails

- Generic output despite real search results: add this to Researcher system prompt: `"You MUST cite specific findings from the search results. Any claim not backed by a search result must be marked [inference]."`
- Tavily returns irrelevant results: the Claude-generated search query may be too broad. Add to the query-generation prompt: `"Be very specific. Include the institution name, the year, and the words 'interview experience' or 'firsthand account'."`

---

## Step 6 — Screen 1: SituationInput + ParticleField

**Time estimate:** 90 minutes  
**Owner:** Frontend person  
**Prerequisite:** Steps 1 + 2 complete (backend mock endpoints running)

### What to Build

Build `SituationInput.jsx` and `ParticleField.jsx` exactly as specified in UI_SPEC.md.

Key implementation notes:
- `ParticleField.jsx` uses `@react-three/fiber`'s `<Canvas>` with `style={{ position: "absolute", inset: 0 }}`
- All other content sits in a `<div>` with `position: "relative", zIndex: 10` on top of the canvas
- Voice input toggle wires to `useVoiceInput.js` hook
- "Launch Swarm" button: calls `setCurrentScreen("MISSION_CONTROL")` in App.jsx and passes situation via state/prop
- Example rotator: uses `useEffect` + `setInterval` with 4000ms

Also build `App.jsx` with the screen state machine:
```javascript
const [screen, setScreen] = useState("SITUATION_INPUT");
const [situation, setSituation] = useState("");

// Wrap all screens in AnimatePresence
// Use the transition spec from UI_SPEC.md
```

### Verify Condition

- Browser shows Screen 1 with dark background, particle field visible
- Particles drift slowly when no voice input
- Clicking the mic button starts voice recording (browser requests microphone permission)
- Speaking into mic causes particles to cluster toward center
- Typing at least 10 characters enables the Launch Swarm button
- Clicking Launch Swarm shows Screen 2 with a smooth fade transition

### If This Step Fails

- Three.js canvas invisible: check `position: absolute` and `z-index: 0` on canvas, `z-index: 10` on UI content
- Particles not visible: check `PointsMaterial` `color` and `size` values — may need `sizeAttenuation: true`
- WebSpeech not starting: run in Chrome, not Firefox. Must be served from localhost (HTTPS or localhost)
- Screen transition not working: verify `AnimatePresence` wraps the conditional screen render

---

## Step 7 — Screen 2: MissionControl with 5 Orbs + Streaming Text

**Time estimate:** 120 minutes  
**Owner:** Frontend person  
**Prerequisite:** Step 6 complete, Step 2 complete (mock streaming endpoint)

### What to Build

Build `MissionControl.jsx` and `AgentOrb.jsx` as specified in UI_SPEC.md.

Key implementation notes:

**Streaming connection:**
```javascript
// In MissionControl.jsx, on mount:
useEffect(() => {
  streamFetch(
    `${BASE_URL}/api/start-session`,
    { situation },
    (chunk) => {
      if (chunk.agent && chunk.chunk) {
        setAgentOutputs(prev => ({
          ...prev,
          [chunk.agent]: (prev[chunk.agent] || "") + chunk.chunk,
        }));
      }
      if (chunk.done) {
        setAgentDone(prev => ({ ...prev, [chunk.agent]: true }));
      }
    }
  );
}, []);
```

**Orb state derivation:**
```javascript
// Derive orb state from agentOutputs and agentDone
const getOrbState = (agent) => {
  if (agentDone[agent]) return "complete";
  if (agentOutputs[agent]?.length > 0) return "active";
  if (agent === "Architect" && !allOthersDone) return "waiting";
  return "idle";
};
```

**Progress bar:**
```javascript
const doneCount = Object.values(agentDone).filter(Boolean).length;
const progress = (doneCount / 5) * 100;
```

Also build `useStreaming.js` hook (`streamFetch` function) as specified in ARCHITECTURE.md.

### Verify Condition

- All 5 orbs are visible in 3D space, floating with idle animation
- On page load, streaming starts and agent orbs begin activating one by one
- Each orb transitions from idle → active → complete as its stream completes
- Streaming text appears in the correct agent card below the canvas
- Progress bar fills as agents complete
- "Begin Session" button appears when all 5 agents show `done: true`

At this stage, the streaming data is from the mock endpoint. The text will say "[MOCK] Researcher analyzing..." — that's correct.

### If This Step Fails

- All orbs activate at once: the mock endpoint is sending all agent chunks without delay. Add `await new Promise(r => setTimeout(r, 500))` between agents in the mock.
- Streaming stops early: check that the `reader.read()` loop in `streamFetch` handles the `\n\n` delimiter correctly — see ARCHITECTURE.md implementation
- Three.js orbs not animating: `useFrame` only runs inside a `Canvas` component — ensure `AgentOrb` is a child of `<Canvas>`

---

## Step 8 — Screen 3: Voice Session with WebSpeech + ElevenLabs

**Time estimate:** 120 minutes  
**Owner:** Frontend person (needs backend person for voiceTurn endpoint)  
**Prerequisite:** Steps 6 + 7 complete, Step 4 complete (real agent outputs)

### What to Build

**Backend (voiceTurn.js — real implementation):**
Wire the mock `voiceTurn.js` to use the actual `judgeOrchestrator.js` agent. This endpoint receives the user's transcript + conversation history + session context and returns what the next persona should say.

```javascript
// backend/routes/voiceTurn.js (real)
import { runJudgeOrchestrator } from "../agents/judgeOrchestrator.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const { transcript, sessionContext, history } = req.body;
  const result = await runJudgeOrchestrator({ transcript, sessionContext, history });

  // Stream character by character for smooth frontend display
  const writeChunk = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  for (const char of result.line) {
    writeChunk({ persona: result.nextPersona, voiceId: result.voiceId, chunk: char, done: false });
    await new Promise(r => setTimeout(r, 15));
  }
  writeChunk({ persona: result.nextPersona, voiceId: result.voiceId, chunk: "", done: true, sessionComplete: result.sessionComplete });
  res.end();
}
```

**Frontend (VoiceSession.jsx):**
Build the full voice session loop:
1. On mount: make initial voice-turn call with empty transcript to get the opening question
2. When full response received: call ElevenLabs to generate audio, play it
3. After audio ends: start WebSpeech listening
4. On silence detection after final result: stop listening, send transcript to `/api/voice-turn`
5. Loop until `sessionComplete: true` in response

Wire `useVoiceOutput.js` (`speakText` function from ARCHITECTURE.md) and `useVoiceInput.js`.

### Verify Condition

- Screen 3 shows the large centered orb
- Opening question text appears and is read aloud in an ElevenLabs voice
- Microphone icon activates after voice finishes playing
- Speaking into the mic captures text and displays it in the transcript
- After 2 seconds of silence, transcript is sent and the next AI turn begins
- A second persona's voice is heard at some point during the session (persona routing works)
- End Session button appears and ends the session on click

### If This Step Fails

- ElevenLabs returns 401: verify `VITE_ELEVENLABS_API_KEY` in frontend `.env` — note the `VITE_` prefix is required for Vite to expose it
- Audio plays but voice doesn't match persona: check that `voiceId` from the backend response is being passed to `speakText`
- WebSpeech starts while AI is still talking: ensure `audio.onended` event starts the listening, not a timer
- Transcript never sends: check `onSilence` callback in `useVoiceInput` — the `silenceThresholdMs` default is 2000ms

---

## Step 9 — Screen 4: Debrief with 3D Terrain + Cinematic Briefing

**Time estimate:** 120 minutes  
**Owner:** Frontend person (needs backend for debrief endpoint)  
**Prerequisite:** Steps 7 + 8 complete

### What to Build

**Backend (debrief.js — real implementation):**
Wire `debrief.js` to use the Debrief Analyzer prompt from PROMPTS.md. This is a non-streaming call (wait for full JSON response). Return the full `DebriefResult` object.

**Frontend (Debrief.jsx + CinematicBriefing.jsx + ConfidenceTerrain.jsx):**

Build in this sub-order:
1. Score reveal (animated counter + ring)
2. `CinematicBriefing.jsx` with typewriter text + ElevenLabs voice
3. `ConfidenceTerrain.jsx` 3D terrain
4. Debrief cards (best/worst moment, content gaps, priority fix)
5. "Run Again — Harder" CTA button

The score ring can be built as a simple SVG arc first (reliable) and upgraded to Three.js if time allows:
```javascript
// SVG arc approach (fast to build, reliable)
const radius = 80;
const circumference = 2 * Math.PI * radius;
const dashOffset = circumference - (circumference * score) / 100;
// <circle stroke-dasharray={circumference} stroke-dashoffset={dashOffset} />
```

### Verify Condition

- After completing a voice session and clicking "End Session": screen transitions to black
- Clarity score counts up from 0 to the actual debrief score over 3 seconds
- CinematicBriefing text streams in while a voice reads it aloud
- At least 3 debrief cards appear with content from the actual debrief response
- "Run Again — Harder" button is visible and clicking it returns to Screen 1 with same situation

### If This Step Fails

- Score doesn't animate: check Framer Motion `useMotionValue` and `animate` usage — target value must be set after mount
- Terrain not visible: check that `confidenceMap` has entries — if debrief JSON parse failed, it may be empty
- CinematicBriefing audio and text out of sync: the text timer is independent of audio — this is expected and acceptable for hackathon

---

## Step 10 — Full End-to-End Integration + Deployment

**Time estimate:** 90–120 minutes  
**Owner:** Both team members  
**Prerequisite:** Steps 6–9 complete

### What to Build

**Part A: Wire real agent outputs through the full pipeline**

Replace all remaining mock data with real API calls:
1. `startSession.js` uses real `runResearcher`, `runProfiler`, `runWeakSpotFinder`, `runVoiceDesigner`, `runArchitect`
2. Store `architectOutput` (personas + session plan) in the streaming response so the frontend receives it when Architect is done — add an extra chunk: `{ agent: "Architect", chunk: "", done: true, sessionData: architectOutput }`
3. Frontend stores `sessionData` in React state and passes it to `VoiceSession.jsx` as the `sessionContext`

**Part B: localStorage session persistence**

Build `useSessionStore.js`:
```javascript
export function saveSession(snapshot) {
  const sessions = JSON.parse(localStorage.getItem("swarm_sessions") || "[]");
  sessions.unshift(snapshot);
  if (sessions.length > 10) sessions.pop();
  localStorage.setItem("swarm_sessions", JSON.stringify(sessions));
}

export function getSessions() {
  return JSON.parse(localStorage.getItem("swarm_sessions") || "[]");
}
```

Save a complete `SessionSnapshot` after the debrief is generated.

**Part C: Deploy**

Backend to Railway:
```bash
cd swarm
# Ensure railway.json is present (see ARCHITECTURE.md)
railway login
railway init
railway up
```

Set environment variables in Railway dashboard: `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `NODE_ENV=production`.

Frontend to Vercel:
```bash
cd frontend
vercel --prod
```

Set environment variables in Vercel dashboard: `VITE_API_BASE_URL=https://[your-railway-url]`, `VITE_ELEVENLABS_API_KEY`.

**Part D: End-to-end demo run**

Run the full demo flow with the actual hackathon situation:
> "I'm about to pitch an AI hackathon project called Swarm to a panel of Silicon Valley judges from HPE, Palantir, and Yahoo — I need to defend the technical architecture and answer hard 'why not just use ChatGPT' questions"

The full run should take ~5–8 minutes (30s input → 60s research → 3min session → 30s debrief).

### Verify Condition

- Full flow completes from Screen 1 to Screen 4 with real data — no mocked content
- ElevenLabs voices are audibly different between at least 2 personas
- Debrief clarity score reflects actual session performance (not hardcoded)
- App is live at a public URL (Railway + Vercel) accessible from any browser
- Demo with hackathon situation runs end-to-end in ~5–8 minutes without errors

### If This Step Fails

- CORS error in production: update `allowedOrigins` in `backend/index.js` with the Vercel production URL
- Streaming broken in production: Railway may buffer SSE — add `res.setHeader("X-Accel-Buffering", "no")` to all streaming routes
- ElevenLabs calls fail from frontend in production: verify `VITE_ELEVENLABS_API_KEY` is set in Vercel dashboard (not just local `.env`)
- Architect session data not reaching frontend: add console.log at both the backend send point and frontend receive point to trace the data flow

---

## Time Budget (24-Hour Hackathon)

| Step | Owner | Estimated Time | Cumulative |
|---|---|---|---|
| Step 1 — Scaffold | Both | 45 min | 0:45 |
| Step 2 — Mock endpoints | Backend | 60 min | 1:45 |
| Step 3 — API wrappers | Backend | 45 min | 2:30 |
| Step 4 — Agent prompts | Backend | 90 min | 4:00 |
| Step 5 — Tavily integration | Backend | 30 min | 4:30 |
| Step 6 — Screen 1 | Frontend | 90 min | 4:30 (parallel) |
| Step 7 — Screen 2 | Frontend | 120 min | 6:30 |
| Step 8 — Screen 3 | Frontend | 120 min | 8:30 |
| Step 9 — Screen 4 | Frontend | 120 min | 10:30 |
| Step 10 — Integration + Deploy | Both | 120 min | 12:30 |
| **Buffer + polish** | Both | 11:30 | **24:00** |

Steps 3–5 (backend) and Step 6 (frontend) run in parallel after Step 2. This is the critical path.

**Buffer time should be used for (in priority order):**
1. Fixing integration bugs found in Step 10
2. Polishing 3D animations in Screens 2 and 3
3. Adding the cinematic debrief voice
4. Session persistence + "Run Again" flow
5. Ask Your Past Session feature
6. Pattern Intelligence (cross-session insights)

---

## Critical Build Notes

### Don't Build These Until Steps 1–10 Are Done
- Pattern intelligence / cross-session analysis
- `querySession.js` (Ask Your Past Session) — build last
- Mobile responsiveness polish
- Full 3D terrain for debrief (SVG arc is fine for demo)

### Always Keep a Working Version
After every step, commit to git. If Step 8 breaks something from Step 7, you can always revert.

### The Demo Fallback
If the live demo crashes: have a screen recording of a successful full run ready. Narrate over it. Never have nothing to show.
