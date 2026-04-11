# SWARM — Testing Document
> Version: 1.0 | This document defines what "working" looks like at every level of the system, and exactly what to do when something breaks. Read this before the demo.

---

## What a Fully Working Demo Looks Like

A fully working Swarm demo completes this exact sequence without interruption, error banners, or manual intervention:

1. **Screen 1 loads** in a browser (Chrome) at the public Vercel URL. Background particles drift slowly. No console errors.

2. **User types** the situation string: `"I'm about to pitch an AI hackathon project called Swarm to a panel of Silicon Valley judges from HPE, Palantir, and Yahoo — I need to defend the technical architecture and answer hard 'why not just use ChatGPT' questions"`

3. **Launch Swarm is clicked.** Screen transitions smoothly to Mission Control. All 5 orbs appear. Within 2–4 seconds, orbs begin activating one by one (or in parallel — Researcher, Profiler, WeakSpotFinder, VoiceDesigner all fire simultaneously; Architect fires after).

4. **Streaming text** appears under each orb as the agents work. The text is specific to the hackathon context — not generic. Researcher output should mention Silicon Valley investors, technical pitches, or similar signals.

5. **Progress bar** fills from 0% to 100%. When Architect completes, the bar hits 100% and the "Begin Session" button fades in.

6. **Begin Session is clicked.** Screen transitions to Voice Session. A large orb appears center screen. Within 3 seconds, a voice speaks the opening question through the browser's audio output. The voice is clearly an AI persona — distinct, not robotic.

7. **User speaks a response.** The microphone indicator shows amber (listening). After 2 seconds of silence, the transcript is captured and the next AI turn begins.

8. **At least two distinct voices** are heard across the session. A skeptical persona pushes back on at least one answer. The session runs for at least 4–6 exchanges.

9. **End Session is clicked.** A confirmation dialog appears. User confirms. Screen transitions to black.

10. **Clarity score counts up** from 0 to the actual score over 3 seconds. A voice (Adam) reads the debrief script aloud while text streams in character by character.

11. **At minimum:** best moment quote, worst moment quote, and priority fix card are visible on screen. All populated with real content from the session — not placeholder text.

12. **"Run Again — Harder" button** is visible and returns to Screen 1.

Total elapsed time from step 2 to step 12: **5–8 minutes** on a clean run.

---

## Manual Test Script

Run this test script every time before the live demo. Perform each step in Chrome on the machine that will be used for the demo. Check the result against the expected outcome.

### Pre-Test Checklist

- [ ] Backend is running and healthy: `curl https://[railway-url]/health` → `{"status":"ok"}`
- [ ] Frontend is deployed: open `https://[vercel-url]` → no blank screen or 404
- [ ] Microphone permission is already granted in Chrome (don't wait for permission prompt during demo)
- [ ] Audio output is working: volume is audible, not muted
- [ ] Internet connection is stable (ElevenLabs + Anthropic + Tavily are all cloud APIs)
- [ ] Chrome is the browser (not Firefox, not Safari for primary demo machine)

### Test Step 1: Input Screen Loads Correctly

**Action:** Open `https://[vercel-url]` in Chrome  
**Expected:** Dark background with particle field visible. "SWARM" title in Playfair Display. Input field and Launch Swarm button visible. No console errors (F12 → Console).  
**Pass condition:** Particles moving, fonts loaded, no red error text in console.  
**Fail:** See "If the frontend doesn't load" below.

---

### Test Step 2: Voice Input Works

**Action:** Click the microphone icon in the input field. Speak: "MIT interview tomorrow."  
**Expected:** Mic icon turns amber/pulsing. Particles cluster toward center. Text appears in the input field matching what was said.  
**Pass condition:** Transcript appears within 1 second of speaking. Accuracy ≥ 80% of spoken words.  
**Fail:** See "If WebSpeech doesn't work" below.

---

### Test Step 3: Phase 2 Streaming Works

**Action:** Type situation in input field. Click "Launch Swarm."  
**Expected:** Transition to Mission Control in ≤ 1s. All 5 orbs visible within 1s. Streaming text starts appearing in agent cards within 5s.  
**Pass condition:** At least 3 agents show streaming text within 10 seconds. Text is English and related to the input situation (not JSON artifacts or error strings).  
**Fail:** See "If streaming breaks" below.

---

### Test Step 4: Agents Produce Specific Output

**Action:** Wait for all 5 agents to complete (progress bar 100%).  
**Expected:** Researcher card mentions the specific context (hackathon, pitch, Silicon Valley, technical architecture). Profiler card describes investor/judge archetypes. Architect card is last to complete.  
**Pass condition:** All 5 agent cards show content. At least one card has situation-specific text that could not have come from generic pre-training alone (i.e., it references the user's exact words or a live research finding).  
**Fail:** See "If agent responses are too generic" below.

---

### Test Step 5: Voice Session Opens and Speaks

**Action:** Click "Begin Session."  
**Expected:** Transition to Voice Session. Single large orb visible. Within 3 seconds, audio plays from browser speakers — the opening question.  
**Pass condition:** Audio audible, voice sounds like a distinct persona (not browser default TTS), text of the question appears in the transcript area.  
**Fail:** See "If ElevenLabs voice doesn't play" below.

---

### Test Step 6: Voice Input in Session Works

**Action:** After the AI finishes speaking, speak a 3–4 sentence answer.  
**Expected:** Amber listening indicator appears. Transcript captures the spoken text. After 2 seconds of silence, the AI processes and responds.  
**Pass condition:** AI responds within 8 seconds of silence. Response is contextually relevant to the answer given (Judge Orchestrator routing is working).  
**Fail:** See "If voice turn cycle breaks" below.

---

### Test Step 7: Persona Switching Works

**Action:** Give a weak or vague answer to the second or third question.  
**Expected:** A different, more critical-sounding persona takes over (voice tone changes, orb morphs to new color).  
**Pass condition:** At least one persona switch occurs naturally during the session. The voice sounds noticeably different.  
**Fail:** If persona never switches — check that `judgeOrchestrator.js` is returning different `nextPersona` values and that the frontend is using the `voiceId` from the response.

---

### Test Step 8: Debrief Generates and Plays

**Action:** Click "End Session" → confirm.  
**Expected:** Screen goes black. Score counts up. Voice begins reading the debrief. Text streams in simultaneously.  
**Pass condition:** Score is a number between 0–100. At least one quoted moment (best or worst) appears on screen. Adam's voice reads the debrief aloud.  
**Fail:** See "If debrief doesn't generate" below.

---

### Test Step 9: Full Reset Works

**Action:** Click "Run Again — Harder."  
**Expected:** Returns to Screen 1 with the same situation pre-filled.  
**Pass condition:** Screen 1 appears, input field contains the original situation. No leftover state from previous session visible.

---

## Diagnostic Guide — What to Check When Things Break

### If Streaming Breaks

**Symptoms:** Agent cards show no text, or show partial text and freeze, or show "[object Object]" or raw JSON.

**Diagnosis checklist:**
1. Open browser DevTools → Network tab. Filter by `start-session`. Is the request being made? Does the response show `Content-Type: text/event-stream`?
2. Is the response status 200, or is it 500/502/504?
3. In the Network response preview, do you see `data: {"agent":...` lines?

**Common causes and fixes:**

| Symptom | Cause | Fix |
|---|---|---|
| No request made at all | `BASE_URL` wrong in frontend `.env` | Check `VITE_API_BASE_URL` points to Railway URL |
| 502 Bad Gateway | Railway backend crashed | Check Railway logs: `railway logs` |
| Stream opens but no data appears | `res.flushHeaders()` missing in route | Add `res.flushHeaders()` before first write |
| Data arrives but shows raw JSON in UI | `streamFetch` not splitting on `\n\n` | Check the `lines.split("\n\n")` logic in `useStreaming.js` |
| Stream starts then hangs at 40% | Architect agent Claude call timing out | Add a 30s timeout to the Claude call; return partial on timeout |
| Railway buffers SSE | Missing header | Add `res.setHeader("X-Accel-Buffering", "no")` to all streaming routes |

---

### If ElevenLabs Voice Doesn't Play

**Symptoms:** AI "speaks" but no audio is heard. Or: audio element exists but plays silence. Or: console error from ElevenLabs.

**Diagnosis checklist:**
1. Open DevTools → Console. Is there a `401 Unauthorized` from `api.elevenlabs.io`?
2. Open DevTools → Network. Is there a request to `api.elevenlabs.io/v1/text-to-speech/...`?
3. Is the browser volume on and not muted?
4. Is autoplay blocked? (Some browsers block audio that isn't triggered by user gesture.)

**Common causes and fixes:**

| Symptom | Cause | Fix |
|---|---|---|
| 401 from ElevenLabs | API key not set or wrong | Check `VITE_ELEVENLABS_API_KEY` in Vercel dashboard. Must be set in dashboard, not just local `.env`. Redeploy after setting. |
| 403 from ElevenLabs | Voice ID doesn't exist | Verify voice IDs in `VOICE_IDS` constant against ElevenLabs dashboard. IDs change between accounts. |
| Request made but audio silent | Blob URL creation failed | Log `audioBlob.size` — if 0, API returned empty body. Check response status. |
| Audio blocked by browser | Autoplay policy | The "Begin Session" button click must directly trigger audio. Ensure `audio.play()` is called within the user-gesture event chain. |
| ElevenLabs rate limit | Too many requests | Use `eleven_turbo_v2` model. Add 300ms delay between consecutive TTS calls in rapid succession. |
| Voice plays but sounds wrong | Wrong voice ID passed | Log `voiceId` at the point `speakText()` is called. |

**Fallback if ElevenLabs is down:**
```javascript
// In useVoiceOutput.js — fallback to browser speechSynthesis
async function speakFallback(text) {
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  // Pick a voice that sounds reasonable
  const voices = synth.getVoices();
  const preferredVoice = voices.find(v => v.name.includes("Google") || v.name.includes("Samantha"));
  if (preferredVoice) utterance.voice = preferredVoice;
  synth.speak(utterance);
  return new Promise(resolve => { utterance.onend = resolve; });
}
```

Show a small banner: "Voice service degraded — using backup audio." This keeps the demo runnable.

---

### If Agent Responses Are Too Generic

**Symptoms:** Researcher output says things like "interviewers value preparation and confidence." Profiler says "they are looking for strong candidates." No mention of the specific scenario.

**Diagnosis checklist:**
1. Is the Tavily search actually running? Log `searchQuery` in `researcher.js` — does it include the specific company/institution/context?
2. Are Tavily results being injected into the Claude prompt? Log `formattedTavilyResults` before the Claude call.
3. Is the system prompt being used? Add a `console.log("Using system prompt:", systemPrompt.slice(0,100))` before the Claude call.

**Common causes and fixes:**

| Symptom | Cause | Fix |
|---|---|---|
| Query is generic | Claude generates bad search query | Hardcode query construction: `"${institution} interview experience 2025 Reddit firsthand"` |
| Tavily returns off-topic results | Search depth insufficient | Set `search_depth: "advanced"` in Tavily call |
| Claude ignores search results | Prompt structure issue | Move search results to the top of the user prompt, before any instructions |
| All agents sound the same | System prompts not being differentiated | Verify each agent file imports its own distinct system prompt string |

---

### If the Voice Turn Cycle Breaks

**Symptoms:** AI speaks, mic indicator appears, user speaks, nothing happens. Or: infinite loop where AI keeps re-asking the same question. Or: session jumps to complete after one turn.

**Diagnosis checklist:**
1. Is `/api/voice-turn` being called after user silence? Check Network tab.
2. Is the response `sessionComplete: true` on the first turn? (If so, Judge Orchestrator is ending session immediately.)
3. Is `conversationHistory` being passed correctly — does it grow with each turn?

**Common causes and fixes:**

| Symptom | Cause | Fix |
|---|---|---|
| Turn never sends after silence | `onSilence` callback not firing | Check `silenceThresholdMs` — if set too high (>5000ms), reduce to 1800ms for demo |
| Session ends after 1 turn | `sessionComplete: true` on first Judge call | Check Orchestrator prompt — `sessionComplete` must only be true when all questions are done |
| Same question asked repeatedly | `currentQuestionIndex` not incrementing | Track `sessionAdvancing` field from orchestrator response to advance index |
| AI response doesn't stream | `voiceTurn.js` not streaming | Verify SSE headers and character-by-character write loop in voiceTurn route |

---

### If the Debrief Doesn't Generate

**Symptoms:** Black screen after End Session but no score appears. Or score appears but cards are empty. Or console shows JSON parse error.

**Diagnosis checklist:**
1. Is `/api/debrief` being called? Check Network tab.
2. What does the raw response look like? DevTools → Network → debrief request → Response tab.
3. Is there a JSON parse error in console?

**Common causes and fixes:**

| Symptom | Cause | Fix |
|---|---|---|
| 500 error from `/api/debrief` | Claude debrief prompt failed | Check that `fullTranscript` is a non-empty array — if session history was lost, pass an empty fallback |
| JSON parse error | Claude returned non-JSON | Add `result.replace(/```json\n?|\n?```/g, "").trim()` before `JSON.parse()` |
| `bestMoment.quote` is null | Transcript was too short | Add a guard: if quote is null/empty, replace with "No clear standout moment — session may have been too brief." |
| Debrief cards empty | `DebriefResult` fields missing | Add default values for all fields in `debrief.js` before returning |

---

## Fallback Plan for Each API

### If Anthropic Claude API Is Down

**Probability:** Low (Anthropic has 99.9% uptime for standard tier)  
**Detection:** 503/529 response from `/api/start-session`

**Fallback:**
1. Retry once after 2 seconds — Claude 529s are transient
2. If still failing: swap to `claude-haiku-3-5` (lower tier, usually available when Sonnet is overloaded) by updating the `model` param in `claude.js`
3. If all Claude models are down: play back a pre-recorded session (see "Pre-Recorded Backup" below)

---

### If Tavily Is Down

**Probability:** Low-Medium  
**Detection:** 503/401 from Tavily endpoint in `researcher.js`

**Fallback:**
The `runResearcher` function must catch Tavily errors and fall back gracefully:
```javascript
try {
  const results = await tavilySearch({ query: searchQuery });
  formattedResults = results.map(...).join("\n\n");
} catch (err) {
  console.warn("Tavily unavailable, using knowledge-only mode:", err.message);
  formattedResults = "[RESEARCH NOTE: Live search unavailable. Analysis based on training data.]";
}
```

The Researcher will still run — it just won't have live search results. Output quality drops but the demo still works.

---

### If ElevenLabs Is Down

**Probability:** Medium (ElevenLabs has had occasional outages)  
**Detection:** 503 from ElevenLabs API in `speakText()`

**Fallback:** Auto-switch to `speechSynthesis` fallback (see "If ElevenLabs voice doesn't play" above). Show a banner. The demo still runs — it just sounds like browser TTS instead of a distinct character voice. This is acceptable for V1 demo survival.

---

### Pre-Recorded Backup Demo

**This is the nuclear option. Always have it ready.**

Before the hackathon demo slot, record a complete screen-capture video of a perfect run:
- Use `OBS Studio` or macOS's native screen recording
- Run the full demo with the hackathon pitch situation
- The video must show the full flow: input → 5 orbs → voice session → debrief
- Duration: 4–5 minutes
- Upload to Google Drive and keep the link bookmarked

If the live demo fails catastrophically:
1. Open the video
2. Say to judges: "Let me show you the full flow — we recorded this from a successful run 30 minutes ago"
3. Play the video while narrating what's happening and why it's impressive
4. Pivot to live demo of any partial functionality still working

**A recorded demo beats a broken live demo every time.**

---

## What "Good Enough" Looks Like at Each Build Stage

Use this table to assess whether the current build is sufficient to demo, even if not all features are complete.

| Stage | What's Working | Demo-able? |
|---|---|---|
| After Step 7 (mock data) | All 4 screens visible, 5 orbs animate, streaming text flows | Yes — show the UI concept, acknowledge "this is mock data" |
| After Step 8 (real Phase 2) | Real agent outputs in Mission Control | Yes — show the swarm researching in real time is impressive even without voice |
| After Step 8 + partial Phase 3 | Real research + voice session with 1 voice | Yes — V1 minimum viable demo |
| After Step 9 (all phases) | Full flow but debrief is text-only | Yes — strong demo |
| After Step 10 (full) | Full flow with cinematic debrief voice | Yes — full V1 demo |

**The minimum demo for prize consideration:** Phases 1, 2, and 3 working end-to-end with real API data and at least 1 ElevenLabs voice. Everything beyond this is impressive but not required.

---

## Performance Benchmarks

These are the target timings for an acceptable demo experience:

| Phase | Target Duration | Acceptable Max |
|---|---|---|
| Phase 1 (input) | Instant | Instant |
| Phase 2 (research swarm) | 12–20 seconds | 30 seconds |
| Phase 3 first turn (AI opens) | < 4 seconds | 8 seconds |
| Phase 3 per-turn cycle | < 6 seconds | 10 seconds |
| Phase 4 debrief generation | < 8 seconds | 15 seconds |

If Phase 2 takes > 30 seconds consistently, the issue is likely:
- Claude API latency is high (check status.anthropic.com)
- Tavily is slow (reduce `maxResults` from 6 to 3)
- `Promise.all` is not actually running in parallel (check that all 4 agents are launched before `await`)

If Phase 3 per-turn is > 10 seconds:
- ElevenLabs `eleven_turbo_v2` should be used (lowest latency model)
- Frontend ElevenLabs call should fire as soon as the backend streams the first complete sentence (don't wait for `done: true`)
- Consider implementing sentence-level streaming: detect first sentence boundary (`.`) in the streamed line, immediately call ElevenLabs with that sentence while the rest continues streaming
