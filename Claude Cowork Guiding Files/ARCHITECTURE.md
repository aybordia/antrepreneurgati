# SWARM — Architecture Document
> Version: 1.0 | This document is the single source of truth for all technical decisions. Claude Code must not deviate from these specs without flagging it.

---

## Complete File Structure

```
swarm/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SituationInput.jsx        # Screen 1 — text/voice input, particle bg
│   │   │   ├── MissionControl.jsx        # Screen 2 — 5 orb mission control
│   │   │   ├── AgentOrb.jsx              # Reusable 3D orb with state-driven animation
│   │   │   ├── VoiceSession.jsx          # Screen 3 — live session room
│   │   │   ├── Debrief.jsx               # Screen 4 — debrief container
│   │   │   ├── CinematicBriefing.jsx     # Streaming text + ElevenLabs audio overlay
│   │   │   ├── ParticleField.jsx         # Three.js particle field background
│   │   │   └── ConfidenceTerrain.jsx     # 3D terrain visualization for debrief
│   │   ├── hooks/
│   │   │   ├── useVoiceInput.js          # WebSpeech API wrapper with silence detection
│   │   │   ├── useVoiceOutput.js         # ElevenLabs audio playback queue
│   │   │   ├── useStreaming.js           # Fetch-based streaming response reader
│   │   │   └── useSessionStore.js        # localStorage read/write for session data
│   │   ├── lib/
│   │   │   └── api.js                    # All fetch() calls, BASE_URL, error handling
│   │   ├── App.jsx                       # Screen state machine + route controller
│   │   ├── main.jsx                      # React 18 root, global providers
│   │   └── index.css                     # Tailwind directives + global font imports
│   ├── public/
│   │   └── grain.png                     # Noise texture for grain overlay effect
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/
│   ├── routes/
│   │   ├── startSession.js              # POST /api/start-session — runs 5 agents
│   │   ├── voiceTurn.js                 # POST /api/voice-turn — judge orchestrator
│   │   ├── debrief.js                   # POST /api/debrief — final analysis
│   │   └── querySession.js             # POST /api/query-session — ask past session
│   ├── agents/
│   │   ├── researcher.js               # Researcher: Tavily → Claude summarize
│   │   ├── profiler.js                 # Profiler: pure Claude, no search
│   │   ├── weakSpotFinder.js           # WeakSpotFinder: pure Claude, structured output
│   │   ├── voiceDesigner.js            # VoiceDesigner: outputs voice spec JSON
│   │   ├── architect.js                # Architect: reads all 4 → builds session plan
│   │   └── judgeOrchestrator.js        # Routes live session turns between personas
│   ├── lib/
│   │   ├── claude.js                   # Anthropic SDK wrapper, streaming helper
│   │   ├── elevenlabs.js               # ElevenLabs REST wrapper, voice ID map
│   │   └── tavily.js                   # Tavily search wrapper, result formatter
│   ├── index.js                        # Express app, CORS, route mounting
│   ├── .env.example                    # All required env vars, documented
│   └── package.json
│
├── SWARM_MASTER.md
├── OVERVIEW.md
├── ARCHITECTURE.md
├── PROMPTS.md
├── UI_SPEC.md
├── BUILD_SEQUENCE.md
├── TESTING.md
└── RISKS.md
```

---

## Data Schemas (TypeScript-Style)

### Core Types

```typescript
// The user's raw input
type SituationInput = {
  text: string;           // e.g. "MIT CS interview in 2 days — I always freeze on why MIT"
  source: "typed" | "voice";
};

// One agent's research output
type AgentOutput = {
  agent: "Researcher" | "Profiler" | "WeakSpotFinder" | "VoiceDesigner" | "Architect";
  content: string;        // Raw streamed text, full output
  done: boolean;          // True when this agent's stream has completed
};

// A streaming chunk from the backend (newline-delimited JSON)
type StreamChunk = {
  agent: AgentOutput["agent"];
  chunk: string;          // Incremental text delta
  done: boolean;
};

// A single agent persona (constructed by Architect based on other agents)
type Persona = {
  name: string;           // e.g. "Dr. Chen", "Marcus", "The Skeptic"
  role: string;           // e.g. "Senior MIT Admissions Officer"
  voiceId: string;        // ElevenLabs voice ID (mapped from VoiceDesigner spec)
  color: string;          // Hex color for orb rendering
  style: string;          // Brief behavioral description for prompt injection
  orbIndex: number;       // 0-4, used for 3D positioning
};

// A single conversational turn in the live session
type ConversationTurn = {
  speaker: "user" | string;  // "user" or persona name
  text: string;
  timestamp: number;
  personaVoiceId?: string;
};

// The full session state (persisted to localStorage)
type SessionSnapshot = {
  id: string;             // UUID
  situation: string;
  createdAt: number;
  agentResearch: Record<AgentOutput["agent"], string>;
  personas: Persona[];
  sessionPlan: SessionPlan;
  conversationHistory: ConversationTurn[];
  debrief?: DebriefResult;
};

// The structured session plan from Architect agent
type SessionPlan = {
  questions: SessionQuestion[];
  totalEstimatedMinutes: number;
  difficultyProgression: "linear" | "escalating" | "wave";
};

type SessionQuestion = {
  text: string;
  assignedPersona: string;  // matches Persona.name
  intent: string;           // e.g. "Test conviction", "Probe specific gap"
  followUpTriggers: string[];  // conditions that trigger a harder follow-up
  curveballAfter?: boolean;
};

// Debrief result
type DebriefResult = {
  clarityScore: number;            // 0–100
  confidenceMap: ConfidenceMap;
  contentGaps: string[];
  bestMoment: { quote: string; reason: string };
  worstMoment: { quote: string; reason: string };
  patterns?: string[];             // cross-session insights (if 2+ sessions exist)
};

type ConfidenceMap = {
  [questionText: string]: {
    score: number;          // 0–100
    notes: string;
  };
};

// Voice turn request
type VoiceTurnRequest = {
  transcript: string;             // What user just said
  sessionContext: string;         // Stringified full session plan + research
  history: ConversationTurn[];
};

// Voice turn response chunk
type VoiceTurnChunk = {
  persona: string;
  voiceId: string;
  chunk: string;
  done: boolean;
};

// Query session request
type QuerySessionRequest = {
  question: string;
  sessionSnapshot: SessionSnapshot;
};

type QuerySessionResponse = {
  answer: string;
};
```

---

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PHASE 1 — INPUT                             │
│  User types/speaks situation → SituationInput.jsx                   │
│  → POST /api/start-session { situation: string }                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 2 — RESEARCH SWARM                         │
│  Backend receives situation                                          │
│                                                                      │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────┐                 │
│  │  Researcher  │  │ Profiler │  │ WeakSpotFinder│  (parallel)     │
│  │  Tavily→Claude│  │  Claude  │  │    Claude     │                 │
│  └──────┬───────┘  └────┬─────┘  └───────┬───────┘                 │
│         │               │                │                           │
│  ┌──────▼───────────────▼────────────────▼───────┐                 │
│  │          VoiceDesigner (parallel)              │                 │
│  │              Claude                            │                 │
│  └───────────────────────────────────────────────┘                 │
│                                                                      │
│  All 4 outputs → Architect                                           │
│  Architect → SessionPlan + Personas array                            │
│                                                                      │
│  Each agent streams chunks via SSE to frontend                       │
│  Frontend updates MissionControl orbs in real time                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 3 — LIVE SESSION                            │
│                                                                      │
│  Session begins. Architect's first question is sent to backend.     │
│  POST /api/voice-turn { transcript: "", ... } (initial call)        │
│                                                                      │
│  Backend → JudgeOrchestrator Claude call                            │
│  → decides next persona + generates their line                      │
│  → streams back { persona, voiceId, chunk, done }                   │
│                                                                      │
│  Frontend receives line → calls ElevenLabs API (from frontend)      │
│  → plays audio via <audio> tag                                       │
│                                                                      │
│  While audio plays → WebSpeech API listens (silence detection)      │
│  User speaks → transcript captured                                  │
│  → POST /api/voice-turn with new transcript                         │
│  → Loop repeats until session ends                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PHASE 4 — DEBRIEF                              │
│                                                                      │
│  POST /api/debrief { fullTranscript, situation, agentResearch }     │
│  Backend → Claude debrief prompt                                    │
│  → returns structured DebriefResult JSON                            │
│                                                                      │
│  Frontend → CinematicBriefing.jsx streams text character by char    │
│  → simultaneously calls ElevenLabs to read the text aloud          │
│  → ConfidenceTerrain.jsx renders 3D terrain from confidenceMap      │
│  → Clarity score ring animates up                                   │
│                                                                      │
│  Session saved to localStorage as SessionSnapshot                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Integration Details

### Anthropic Claude API

**File:** `backend/lib/claude.js`

```javascript
// backend/lib/claude.js
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Streaming call — yields text chunks
export async function streamClaude({ systemPrompt, userPrompt, model = "claude-sonnet-4-5", maxTokens = 2048 }) {
  const stream = await client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return stream; // caller iterates via stream.text_stream
}

// Non-streaming call — returns full response text
export async function callClaude({ systemPrompt, userPrompt, model = "claude-sonnet-4-5", maxTokens = 2048 }) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return response.content[0].text;
}
```

**Error handling:** Wrap all calls in try/catch. On 529 (overloaded) retry once after 2s. On 401/403 return error to client. On timeout (>30s) return partial result with `done: true` and log the failure.

**Rate limits:** claude-sonnet-4-5 allows 50 requests/minute at the standard tier. 5 parallel agent calls will hit this during Phase 2. Use `Promise.all` carefully — all 5 calls fire simultaneously, but Phase 2 is the only place this happens.

---

### Tavily Search API

**File:** `backend/lib/tavily.js`

```javascript
// backend/lib/tavily.js
export async function tavilySearch({ query, maxResults = 5 }) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: "advanced",
      include_answer: true,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = await response.json();

  // Format for Claude consumption
  return data.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content.slice(0, 500), // truncate to keep token count manageable
    score: r.score,
  }));
}
```

**Query construction for Researcher:** Always inject the specific scenario. For "MIT CS interview" → query = `"MIT Computer Science undergraduate interview 2025 2026 experience Reddit questions asked"`. The Researcher agent constructs its own Tavily query from the situation string using Claude first, then runs the search.

**Error handling:** If Tavily fails (network, API key issue), Researcher falls back to Claude's training data with a note in the output: `[RESEARCH NOTE: Live search unavailable. Analysis based on training data as of 2024.]`

---

### ElevenLabs API

**File:** `backend/lib/elevenlabs.js` (used for voice spec lookup only)

**Primary use:** ElevenLabs calls happen from the **frontend** (`useVoiceOutput.js`) to avoid streaming audio through the backend, which would add 200–400ms of latency. The frontend calls ElevenLabs directly with the API key from the environment.

```javascript
// frontend/src/hooks/useVoiceOutput.js — ElevenLabs call
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;

export async function speakText({ text, voiceId, stability = 0.5, similarityBoost = 0.8 }) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2",          // Lowest latency model
      voice_settings: { stability, similarity_boost: similarityBoost },
    }),
  });

  if (!response.ok) throw new Error(`ElevenLabs error: ${response.status}`);
  
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  return audio; // caller calls audio.play()
}
```

**Voice ID Map** — hardcoded in `backend/lib/elevenlabs.js` and mirrored in frontend:

```javascript
// These are real ElevenLabs v2 voice IDs — verify they exist at launch
export const VOICE_IDS = {
  warm_female:    "EXAVITQu4vr4xnSDxMaL",  // Rachel — warm, clear, American
  authoritative_male: "VR6AewLTigWG4xSOukaG", // Arnold — deep, confident
  skeptical_male: "TxGEqnHWrfWFTfGW9XjX",    // Josh — analytical, dry
  youthful_female: "jBpfuIE2acCO8z3wKNLl",   // Gigi — bright, energetic
  measured_older_male: "pNInz6obpgDQGcFmaJgB", // Adam — deliberate, serious
};
```

**CRITICAL:** The `VITE_ELEVENLABS_API_KEY` will be exposed in the browser bundle. This is acceptable for a hackathon demo. In production, proxy through backend. Note this explicitly in a code comment.

---

### WebSpeech API

**File:** `frontend/src/hooks/useVoiceInput.js`

```javascript
// Complete implementation
export function useVoiceInput({ onResult, onSilence, silenceThresholdMs = 2000 }) {
  const recognition = useRef(null);
  const silenceTimer = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  const start = useCallback(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      console.error("WebSpeech not supported in this browser");
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition.current = new SpeechRecognition();
    recognition.current.continuous = true;
    recognition.current.interimResults = true;
    recognition.current.lang = "en-US";

    recognition.current.onresult = (event) => {
      clearTimeout(silenceTimer.current);
      const latest = event.results[event.results.length - 1];
      const text = latest[0].transcript;
      setTranscript(text);
      if (latest.isFinal) {
        onResult?.(text);
        // Reset silence detection after final result
        silenceTimer.current = setTimeout(() => onSilence?.(), silenceThresholdMs);
      }
    };

    recognition.current.onerror = (e) => {
      if (e.error === "not-allowed") {
        alert("Microphone access denied. Please allow mic access and refresh.");
      }
    };

    recognition.current.start();
    setIsListening(true);
    return true;
  }, [onResult, onSilence, silenceThresholdMs]);

  const stop = useCallback(() => {
    recognition.current?.stop();
    setIsListening(false);
  }, []);

  return { start, stop, isListening, transcript };
}
```

**Browser support:** Chrome 33+, Edge 79+, Safari 14.1+. Firefox does NOT support WebSpeech. The demo must run in Chrome. Put a browser check on load and show a clear warning if not Chrome/Edge.

---

## Streaming Architecture

### How Server-Sent Streaming Works in This App

The backend uses Express with no SSE library — raw fetch streaming via `res.write()`. The frontend uses a custom `useStreaming.js` hook with the `ReadableStream` API.

**Backend Pattern (all streaming routes):**

```javascript
// routes/startSession.js — streaming pattern
export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const writeChunk = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // ... agent calls, each chunk calls writeChunk()
    writeChunk({ agent: "Researcher", chunk: "...", done: false });
    // ... when done:
    writeChunk({ agent: "Researcher", chunk: "", done: true });
  } catch (err) {
    writeChunk({ error: err.message });
  } finally {
    res.end();
  }
}
```

**Frontend Pattern (`useStreaming.js`):**

```javascript
export async function streamFetch(url, body, onChunk) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop(); // keep incomplete chunk

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(line.slice(6));
          onChunk(parsed);
        } catch (e) {
          console.warn("Failed to parse stream chunk:", line);
        }
      }
    }
  }
}
```

**5-Agent Parallelism in Phase 2:**

The `startSession.js` route fires Researcher, Profiler, WeakSpotFinder, and VoiceDesigner in parallel using `Promise.all`. Each streams to the same SSE connection with their `agent` field as the discriminator. When all 4 are done, Architect fires sequentially (it needs the other 4's output). The frontend reads the `agent` field and routes each chunk to the correct orb.

```javascript
// Parallel fire — backend
await Promise.all([
  runResearcher(situation, writeChunk),
  runProfiler(situation, writeChunk),
  runWeakSpotFinder(situation, writeChunk),
  runVoiceDesigner(situation, writeChunk),
]);

// Sequential — architect reads all 4
const architectOutput = await runArchitect({ situation, researcherOutput, profilerOutput, weakSpotOutput, voiceDesignerOutput, writeChunk });
```

---

## CORS Configuration

```javascript
// backend/index.js
import cors from "cors";

const allowedOrigins = [
  "http://localhost:5173",   // Vite dev
  "https://swarm.vercel.app", // Vercel prod — update when URL is known
  /\.vercel\.app$/,           // Vercel preview deployments
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server
    if (allowedOrigins.some(o => typeof o === "string" ? o === origin : o.test(origin))) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
}));
```

---

## Environment Variables

**`backend/.env.example`:**
```
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Tavily
TAVILY_API_KEY=tvly-...

# Server
PORT=3001
NODE_ENV=development
```

**`frontend/.env.example`:**
```
# Backend URL
VITE_API_BASE_URL=http://localhost:3001

# ElevenLabs (exposed to browser — hackathon only)
VITE_ELEVENLABS_API_KEY=...
```

**Production overrides (Railway + Vercel):**
- Railway: set env vars in Railway dashboard under "Variables"
- Vercel: set env vars in Vercel dashboard under "Environment Variables"
- The Vercel frontend's `VITE_API_BASE_URL` must point to the Railway backend URL

---

## Backend Package Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  },
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "engines": { "node": ">=18" }
}
```

## Frontend Package Dependencies

```json
{
  "dependencies": {
    "@react-three/fiber": "^8.16.8",
    "@react-three/drei": "^9.105.4",
    "framer-motion": "^11.2.10",
    "gsap": "^3.12.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.165.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "vite": "^5.3.1"
  }
}
```

---

## Express App Structure

```javascript
// backend/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import startSession from "./routes/startSession.js";
import voiceTurn from "./routes/voiceTurn.js";
import debrief from "./routes/debrief.js";
import querySession from "./routes/querySession.js";

dotenv.config();
const app = express();
app.use(cors({ /* config above */ }));
app.use(express.json({ limit: "2mb" }));  // session context can be large

app.post("/api/start-session", startSession);
app.post("/api/voice-turn", voiceTurn);
app.post("/api/debrief", debrief);
app.post("/api/query-session", querySession);

app.get("/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Swarm backend running on :${PORT}`));
```

---

## localStorage Schema

```javascript
// useSessionStore.js — storage key convention
const SESSIONS_KEY = "swarm_sessions";      // Array of SessionSnapshot
const CURRENT_KEY = "swarm_current";        // Current in-progress session

// Max stored sessions: 10 (FIFO, oldest removed first)
// Max session size: ~50KB per session (transcripts can get long)
```

---

## Deployment Configuration

### Railway (Backend)

`railway.json`:
```json
{
  "build": { "builder": "nixpacks" },
  "deploy": {
    "startCommand": "node backend/index.js",
    "restartPolicyType": "on_failure"
  }
}
```

Set env vars: `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `NODE_ENV=production`

### Vercel (Frontend)

`vercel.json`:
```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite"
}
```

Set env vars: `VITE_API_BASE_URL` (Railway URL), `VITE_ELEVENLABS_API_KEY`

---

## Critical Architecture Decisions & Rationale

| Decision | Rationale |
|---|---|
| ElevenLabs called from frontend | Eliminates backend audio streaming latency (~300ms saved per turn) |
| WebSpeech API (not Whisper) | Zero cost, zero latency, browser-native. Whisper adds 1–3s per utterance |
| SSE not WebSockets | Unidirectional streaming is sufficient; SSE requires no library |
| localStorage not database | No auth, no server-side state needed. Sufficient for demo + hackathon |
| claude-sonnet-4-5 not Opus | Sonnet is 5x cheaper, nearly as capable for structured output, faster streaming |
| Promise.all for 4 agents | Reduces Phase 2 time from ~60s serial to ~15s parallel |
| Architect runs last | It synthesizes all other outputs — cannot run in parallel |
