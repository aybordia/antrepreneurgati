# SWARM — UI Specification
> Version: 1.0 | This document specifies every screen, component, animation, and design token. Claude Code should not make visual decisions not described here. If a scenario is not covered, choose the option most consistent with the Cognitive Noir design language.

---

## Design System — "Cognitive Noir"

### Design Token Table

| Token Name | Value | Usage |
|---|---|---|
| `--color-bg` | `#0C0C0F` | Page background, all screen backgrounds |
| `--color-primary` | `#7B6CFF` | Electric indigo — primary CTA, active highlights, agent Researcher orb |
| `--color-amber` | `#F5A623` | Warm amber — recording state, active listening, agent Architect orb |
| `--color-success` | `#c8f064` | Electric green — positive debrief moments, agent Weak Spot Finder orb |
| `--color-teal` | `#6ee7b7` | Secondary accent — agent Profiler orb, progress bars |
| `--color-coral` | `#FF6B6B` | Coral — error states, pressure moments, agent Voice Designer orb |
| `--color-text-primary` | `#F0EEF8` | Off-white — all primary body text |
| `--color-text-secondary` | `#8B8A9B` | Muted gray — secondary labels, metadata |
| `--color-text-mono` | `#6ee7b7` | Teal — timestamps, agent names, code-style text |
| `--color-glass-bg` | `rgba(255,255,255,0.04)` | Glassmorphism card backgrounds |
| `--color-glass-border` | `rgba(255,255,255,0.08)` | Glassmorphism card borders |
| `--font-display` | `'Playfair Display', serif` | Page titles, scores, cinematic text |
| `--font-ui` | `'IBM Plex Sans', sans-serif` | All UI elements, buttons, labels, body |
| `--font-mono` | `'IBM Plex Mono', monospace` | Agent names, timestamps, transcript text |
| `--grain-opacity` | `0.03` | Grain overlay intensity |
| `--blur-glass` | `12px` | Backdrop blur for glass cards |
| `--border-radius-card` | `16px` | All card elements |
| `--border-radius-orb` | `50%` | Orb shapes (handled in Three.js) |
| `--transition-screen` | `0.6s cubic-bezier(0.16, 1, 0.3, 1)` | Screen-to-screen transitions |
| `--transition-micro` | `0.2s ease` | Button hovers, state changes |
| `--shadow-orb` | `0 0 40px currentColor` | Orb glow effect |

### Font Imports (in `index.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
```

### Global CSS

```css
/* index.css */
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #0C0C0F;
  color: #F0EEF8;
  font-family: 'IBM Plex Sans', sans-serif;
  overflow: hidden;       /* No scroll — single page app */
  height: 100vh;
  width: 100vw;
}

/* Grain overlay — applied via pseudo-element on body */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url('/grain.png');
  background-size: 200px 200px;
  opacity: 0.03;
  pointer-events: none;
  z-index: 9999;
}

/* Slow radial gradient drift — animated in App.jsx */
.bg-gradient {
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at 30% 50%, rgba(123, 108, 255, 0.08) 0%, transparent 60%),
              radial-gradient(ellipse at 70% 20%, rgba(110, 231, 183, 0.05) 0%, transparent 50%);
  animation: gradientDrift 20s ease-in-out infinite alternate;
  pointer-events: none;
}

@keyframes gradientDrift {
  0% { transform: translate(0%, 0%) scale(1); }
  100% { transform: translate(3%, 5%) scale(1.05); }
}
```

### Glassmorphism Card Mixin

```css
.glass-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

---

## Screen State Machine (`App.jsx`)

The app has exactly 4 screens. There is no React Router — screen state is managed in `App.jsx` with a `useState` enum.

```javascript
const SCREENS = {
  SITUATION_INPUT: "SITUATION_INPUT",
  MISSION_CONTROL: "MISSION_CONTROL",
  VOICE_SESSION: "VOICE_SESSION",
  DEBRIEF: "DEBRIEF",
};
```

Transitions are managed by Framer Motion's `AnimatePresence`. Every screen component receives `initial`, `animate`, and `exit` props.

**Transition spec (screen-level):**
```javascript
// Applied to every screen's outer div
const screenTransition = {
  initial: { opacity: 0, scale: 0.98, filter: "blur(8px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, scale: 1.02, filter: "blur(8px)", transition: { duration: 0.4, ease: [0.4, 0, 1, 1] } },
};
```

---

## Screen 1 — Situation Input (`SituationInput.jsx`)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [grain overlay]  [slow gradient bg]                        │
│                                                             │
│  [ParticleField — full-screen Three.js canvas]             │
│           (reacts to voice input amplitude)                 │
│                                                             │
│                    SWARM                                    │
│               [Playfair Display, 14px, tracking wide]      │
│                                                             │
│         Prepare for what's actually coming.                 │
│           [IBM Plex Sans 300, 18px, #8B8A9B]               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Describe your situation...                          │  │
│  │  [IBM Plex Sans, 16px, #F0EEF8]                      │  │
│  │                                        [🎤]          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  When recording:                                            │
│  "Listening..." [amber dot pulsing]                        │
│                                                             │
│              [ Launch Swarm → ]                             │
│   [disabled until ≥10 chars, then fades in]                │
│                                                             │
│  Try: "MIT CS interview in 2 days — I always..."           │
│  [IBM Plex Mono, 12px, #8B8A9B, cycles through examples]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Details

**Text Input:**
- `<textarea>` with 2 rows, auto-expands to 4 rows max
- Border: `1px solid rgba(255,255,255,0.08)` default → `1px solid rgba(123,108,255,0.5)` on focus
- Background: `rgba(255,255,255,0.04)`
- Border-radius: 12px
- Padding: `16px 20px`
- Placeholder text: `"Describe your situation in one sentence..."`
- Font: IBM Plex Sans 16px, `#F0EEF8`
- On focus: subtle glow — `box-shadow: 0 0 0 2px rgba(123,108,255,0.2)`

**Voice Input Toggle (🎤 button):**
- Position: absolute, bottom-right corner of textarea
- Size: 36px × 36px, circular
- Default state: `background: rgba(255,255,255,0.08)`, icon white at 60% opacity
- Active/recording state: `background: rgba(245,166,35,0.2)`, icon amber, amber pulse ring
- Pulse ring animation (recording):
  ```css
  @keyframes amberPulse {
    0% { box-shadow: 0 0 0 0 rgba(245,166,35,0.4); }
    100% { box-shadow: 0 0 0 12px rgba(245,166,35,0); }
  }
  ```
- On click: starts WebSpeech recording, fills textarea with transcript in real time
- Click again: stops recording, final transcript locked in textarea

**Launch Swarm Button:**
- Height: 52px, border-radius: 12px
- Background: `linear-gradient(135deg, #7B6CFF 0%, #9B8DFF 100%)`
- Text: "Launch Swarm →", IBM Plex Sans 500, 15px, white
- Disabled state (< 10 chars): `opacity: 0.3`, `cursor: not-allowed`
- Enabled transition: `transition: opacity 0.4s ease`
- Hover: `transform: translateY(-1px)`, `box-shadow: 0 8px 25px rgba(123,108,255,0.35)`
- Active: `transform: translateY(0px)`
- On click: sets situation state → triggers navigation to MISSION_CONTROL

**Example Prompt Rotator:**
- 4 examples, cycling every 4 seconds with a fade transition (0.4s opacity)
- Examples:
  1. "MIT CS interview in 2 days — I always freeze on 'why MIT'"
  2. "Pitching to Sequoia next week — they'll push hard on our moat"
  3. "Salary negotiation tomorrow — I tend to undersell myself"
  4. "Stanford med school interview — MMI format, ethical scenarios"

### ParticleField (`ParticleField.jsx`) — Screen 1 Configuration

```javascript
// Three.js configuration for Screen 1
const PARTICLE_COUNT = 1200;
const PARTICLE_COLOR = 0x7B6CFF;    // indigo
const PARTICLE_SIZE = 1.5;          // px
const FIELD_RADIUS = 8;             // unit radius

// Default state: particles drift slowly, gentle Brownian motion
// Voice active state: particles cluster toward center, amplitude drives size
// Voice silent: particles drift back out over 2s

// useVoiceInput amplitude is 0-100 — map to particle cluster force
// At amplitude 0: particles drift at 0.002 speed
// At amplitude 100: particles rush toward center at 0.04 speed, each particle +50% size
```

**Three.js setup:**
- Canvas fills entire viewport, `position: absolute`, `z-index: 0`
- Main UI content is `z-index: 10`, positioned above canvas
- Camera: `PerspectiveCamera(60, aspect, 0.1, 100)`, position `(0, 0, 5)`
- Particles use `BufferGeometry` + `PointsMaterial`
- Each frame: update particle positions with sine-wave drift + amplitude-based force

---

## Screen 2 — Mission Control (`MissionControl.jsx`)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [grain + gradient bg]                                       │
│                                                             │
│  MISSION CONTROL                  ● Swarm Active            │
│  [Playfair 24px]                  [IBM Mono 12px, green]    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [Three.js Canvas — 5 orbs floating in space]        │  │
│  │                                                       │  │
│  │     ○ Researcher      ○ Profiler    ○ WeakSpot        │  │
│  │     [indigo]          [teal]        [green]           │  │
│  │                                                       │  │
│  │           ○ VoiceDesigner    ○ Architect              │  │
│  │           [coral]            [amber]                  │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  (orb canvas height: 40vh)                                  │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │RESEARCHER│  │ PROFILER│  │WEAKSPOT │                     │
│  │[streaming│  │[stream] │  │[stream] │                     │
│  │ text...] │  │         │  │         │                     │
│  └─────────┘  └─────────┘  └─────────┘                     │
│  ┌─────────────────┐  ┌────────────────────┐                │
│  │ VOICE DESIGNER  │  │    ARCHITECT        │               │
│  │ [streaming text]│  │ (waits for others)  │               │
│  └─────────────────┘  └────────────────────┘                │
│                                                             │
│  ████████████████████░░░░░  73% — Designing your session  │
│  [progress bar: linear-gradient indigo to teal]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Agent Orb Positions (in 3D space, normalized -1 to 1)

```javascript
const ORB_POSITIONS = [
  { agent: "Researcher",    x: -2.5, y: 1.2,  z: 0, color: "#7B6CFF" },  // indigo
  { agent: "Profiler",      x: 0,    y: 1.8,  z: 0, color: "#6ee7b7" },  // teal
  { agent: "WeakSpotFinder",x: 2.5,  y: 1.2,  z: 0, color: "#c8f064" },  // green
  { agent: "VoiceDesigner", x: -1.2, y: -0.8, z: 0, color: "#FF6B6B" },  // coral
  { agent: "Architect",     x: 1.2,  y: -0.8, z: 0, color: "#F5A623" },  // amber
];
```

### AgentOrb (`AgentOrb.jsx`) — States and Animations

**States:** `idle` | `active` | `complete` | `waiting`

```javascript
// State machine for each orb during Phase 2
// idle: before this agent starts. Slow drift, small size, low glow.
// active: while streaming. Pulses, grows, shoots particle beam toward center.
// complete: stream done. Gentle steady glow, no pulse.
// waiting: for Architect specifically — shows "Waiting for peers..." label

// Three.js orb = SphereGeometry(0.3, 32, 32) + MeshStandardMaterial
// Material properties by state:
// idle:     emissiveIntensity: 0.2, scale: 1.0
// active:   emissiveIntensity: 0.8, scale: 1.15, pulsing animation
// complete: emissiveIntensity: 0.4, scale: 1.0, no pulse
```

**Idle animation:** Each orb floats with a slow sine wave:
```javascript
// In useFrame (React Three Fiber)
mesh.position.y = baseY + Math.sin(elapsed * 0.8 + orbIndex) * 0.08;
mesh.rotation.y += 0.003;
```

**Active animation (streaming):**
```javascript
// Pulse: scale oscillates ±0.15 at 2Hz
mesh.scale.setScalar(1.15 + Math.sin(elapsed * 12) * 0.05);
// Glow: emissiveIntensity oscillates 0.6–1.0 at 2Hz
material.emissiveIntensity = 0.8 + Math.sin(elapsed * 12) * 0.2;
// Particle beam: small particles stream from orb toward center (0,0,0)
// Implemented as 20 small Points objects with short lifetime
```

**Particle Beam (active state only):**
```javascript
// 20 particles shoot from orb toward center over 1.5 seconds
// Each particle: size 0.05, color matches orb, opacity fades 1→0 on journey
// New batch fires every 200ms while orb is active
```

**Orb label (below each orb):**
- Font: IBM Plex Mono 11px, `#8B8A9B`
- Text: agent name (all caps)
- Position: 3D HTML overlay using `@react-three/drei`'s `<Html>` component

### Agent Output Cards (below the orb canvas)

```javascript
// Layout: CSS grid, 3 columns top row + 2 columns bottom row
// Card = glass-card style
// Each card:
//   - Header: agent name (IBM Plex Mono 11px teal, all caps)
//   - Status badge: "● Active" (green, pulsing) | "✓ Done" (green static) | "Waiting..." (gray)
//   - Body: streaming text, IBM Plex Sans 12px, max-height 80px, overflow scroll
//   - Text appears via character-by-character streaming
```

**Streaming text behavior:**
- Text streams in as chunks arrive from backend
- Auto-scrolls to bottom of card as new text appears
- Scroll: `behavior: "smooth"` via `useEffect` on text change
- When `done: true`: card border changes to `rgba(200,240,100,0.2)` (subtle green glow)

### Progress Bar

```javascript
// Progress calculation:
// Each of the 5 agents contributes 20% when done
// Architect counts as 20% but only starts counting when other 4 are complete
// Progress bar width: animated via Framer Motion layoutId

// Bar style:
// height: 4px, border-radius: 2px
// background: linear-gradient(to right, #7B6CFF, #6ee7b7)
// background-color (track): rgba(255,255,255,0.08)

// Label: "73% — Designing your session" (dynamically updates with phase descriptions)
// Phase labels:
//   0-20%: "Researching your scenario..."
//   20-40%: "Building your panel..."
//   40-60%: "Targeting your weak spots..."
//   60-80%: "Designing your voices..."
//   80-100%: "Architecting your session..."
//   100%: "Session ready. Begin when you are."
```

**After 100%:** A "Begin Session" button fades in (same style as Launch Swarm). Clicking it navigates to VOICE_SESSION.

---

## Screen 3 — Voice Session (`VoiceSession.jsx`)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [minimal — almost nothing UI, pure session]                │
│                                                             │
│                   [Active Persona Orb]                      │
│              [large, front and center, 3D]                  │
│         slowly rotating, gentle ambient glow                │
│                                                             │
│        "Dr. Chen, MIT Admissions"                           │
│         [IBM Plex Mono 12px, #8B8A9B, fades in]           │
│                                                             │
│    ┌──────────────────────────────────────────────┐         │
│    │  "Tell me about something you've been        │         │
│    │   obsessing over that isn't on your         │         │
│    │   application..."                            │         │
│    │  [transcript — streaming in]                 │         │
│    │  [IBM Plex Sans 16px, #F0EEF8]              │         │
│    └──────────────────────────────────────────────┘         │
│                                                             │
│    ────────────────────────────────────────────             │
│    [Audio waveform ring around orb — Three.js]             │
│                                                             │
│    [User mic waveform — bottom right]                       │
│    ● Listening...                                           │
│    [amber, pulsing, only when recording]                   │
│                                                             │
│    [ End Session ]  [ghost button, bottom right]           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Active Orb

```javascript
// Single large orb, center screen
// Size: 1.2 radius (4x larger than Mission Control orbs)
// Rotation: slow Y-axis spin at 0.005 rad/frame
// Position: center (0, 0.5, 0)
// Color + voiceId: dynamically set from current persona

// When persona changes (mid-session):
// Morph animation: scale shrinks to 0 over 0.4s, color shifts, scale grows back over 0.4s
// Use Framer Motion animatePresence on the <mesh> wrapper
```

**3D Audio Waveform Ring:**
```javascript
// Implemented as a TorusGeometry ring wrapping the orb
// TorusGeometry(1.5, 0.02, 8, 128)   -- thin ring, many segments
// When AI is speaking: ring animates — each segment's Y position driven by sin(index + elapsed * speed)
// Creates a "talking" waveform effect
// Amplitude of wave: proportional to ElevenLabs audio playback volume (use Web Audio API analyser)
// When silent: ring flat (no wave displacement)

// Ring color: matches active orb color, opacity 0.6
```

**User Waveform:**
```javascript
// Small waveform visualization in bottom-right corner
// Width: 120px, Height: 40px
// Canvas element drawing microphone input amplitude
// Color: #F5A623 (amber) when listening
// Color: rgba(255,255,255,0.2) when not listening
// Pulsing dot: 8px circle, amber, CSS keyframe pulse animation
```

### Session Transcript

```javascript
// Full conversation history scrolls upward as session progresses
// Most recent turn always visible
// Speaker label in IBM Plex Mono 11px, color = persona orb color or amber for user
// Text in IBM Plex Sans 14px, #F0EEF8
// Max height: 30vh, overflow-y scroll, fade-to-bg gradient at top
// Auto-scrolls to bottom on new turns
```

### Persona Change Animation

When the Judge Orchestrator switches personas:
1. Current orb: scale `1.2 → 0`, opacity `1 → 0` over 400ms, ease-out
2. Wait 150ms
3. New orb: scale `0 → 1.2`, opacity `0 → 1` over 400ms, ease-out, new color
4. New persona name fades in below orb
5. Transcript line for new persona fades in using typewriter effect

### End Session Button

```javascript
// Ghost button: border 1px solid rgba(255,255,255,0.12), no background fill
// Text: "End Session", IBM Plex Sans 14px, #8B8A9B
// Position: bottom-right, fixed, always visible
// On click: shows confirmation dialog: "End session and get debrief?" [Yes] [Continue]
// "Yes" → navigates to DEBRIEF, triggers POST /api/debrief
```

---

## Screen 4 — Debrief (`Debrief.jsx`)

### Layout — Phase Sequence

The debrief screen has 4 sequential phases that play automatically:

**Phase A: Score Reveal (0–4 seconds)**
```
┌─────────────────────────────────────────────────────────────┐
│  [pure black screen — background turns to full #000]        │
│                                                             │
│               [3D ring visualization]                       │
│                                                             │
│                    71                                       │
│               [Playfair Display 80px]                      │
│                                                             │
│               CLARITY SCORE                                 │
│            [IBM Plex Mono 12px, #8B8A9B]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Score counts from 0 to final score over 3 seconds (Framer Motion `useMotionValue` + `animate`). The 3D ring fills clockwise from 0% to `score%` over the same 3 seconds.

**Ring (ConfidenceTerrain.jsx does terrain, `Debrief.jsx` does the ring directly):**
```javascript
// Ring: TorusGeometry(1.2, 0.06, 8, 128)
// Fill progress: achieved by rotating a clip plane or using shader
// Simpler approach: use zwei arc/curve — render progress as a Line3 arc
// Color: linear gradient from #7B6CFF (0%) to #c8f064 (100%) based on score value
// The ring spins slowly (0.002 rad/frame) while filling
```

**Phase B: CinematicBriefing (4–30+ seconds)**
```
┌─────────────────────────────────────────────────────────────┐
│  [pitch black, ring fades out]                              │
│                                                             │
│  Session complete.                                          │
│                                                             │
│  Your clarity score: 71 out of 100. [typewriter]           │
│  [Playfair Display 24px, #F0EEF8]                          │
│                                                             │
│  Your strongest moment: "I don't care about                │
│  the brand — I need those specific professors."             │
│  [streams in as ElevenLabs reads aloud]                    │
│                                                             │
│  ...                                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**CinematicBriefing component:**
```javascript
// Text streams in character by character at 35ms per character
// Paragraph breaks: 600ms pause between paragraphs
// ElevenLabs audio plays simultaneously (voice + text in sync)
// Audio plays the full script, text streams at a rate approximating speech pace
// If audio and text get out of sync: text wins (text is always ahead or at audio position)
```

**Phase C: Confidence Terrain (after CinematicBriefing completes)**

```javascript
// ConfidenceTerrain.jsx renders a 3D PlaneGeometry terrain
// PlaneGeometry(10, 6, 40, 24)   -- 40×24 segments
// Each segment's Y (height) = confidenceMap score for the nearest question
// High score (80+) → tall peak, color green (#c8f064)
// Low score (under 50) → valley, color coral (#FF6B6B)
// Mid scores → flat, color indigo (#7B6CFF)

// Terrain generation:
// 1. Map each question's score to a height value (-1.0 to 1.0)
// 2. Interpolate between questions to create smooth terrain
// 3. Apply Perlin noise for surface texture (use three/addons simplex-noise)

// Camera: orbits slowly around the terrain (OrbitControls auto-rotate)
// Or: fixed camera angle at 45° looking down-forward at terrain
// Light: ambient light (0.4 intensity) + directional from top-right

// Labels: drei <Html> labels floating above peaks (question name) and valleys (stumble point)
```

**Phase D: Cards and CTA**

Fade in sequentially (each card fades in 500ms after previous):

```javascript
// Card 1: Best Moment
// border-left: 3px solid #c8f064
// Label: "STRONGEST MOMENT", IBM Plex Mono 11px, #c8f064
// Quote: IBM Plex Sans italic 15px, #F0EEF8
// Reason: IBM Plex Sans 13px, #8B8A9B

// Card 2: Weakest Moment
// border-left: 3px solid #FF6B6B
// Label: "CRITICAL STUMBLE", IBM Plex Mono 11px, #FF6B6B
// Quote: IBM Plex Sans italic 15px
// Reason: IBM Plex Sans 13px, #8B8A9B

// Card 3: Content Gaps
// border-left: 3px solid #F5A623
// Label: "CONTENT GAPS", IBM Plex Mono 11px, #F5A623
// List of gap strings

// Card 4: Priority Fix
// Full-width, glass-card style
// Label: "FOCUS ON THIS"
// Text: debrief.priorityFix in Playfair Display 18px

// CTA Button: "Run Again — Harder →"
// Same style as Launch Swarm but amber instead of indigo
// background: linear-gradient(135deg, #F5A623 0%, #FFB347 100%)
// Pulsing animation: box-shadow oscillates amber glow every 2s
// On click: clears session, goes back to Screen 1, pre-fills situation with same text + " — harder mode"
```

---

## Component Specifications

### `ParticleField.jsx`

| Prop | Type | Description |
|---|---|---|
| `amplitude` | `number (0-100)` | Voice input amplitude, drives cluster force |
| `active` | `boolean` | Whether voice is actively recording |

Internal state: 1200 particle positions as `Float32Array`. Every frame: update positions with drift + cluster math.

### `AgentOrb.jsx`

| Prop | Type | Description |
|---|---|---|
| `agent` | `string` | Agent name |
| `color` | `string` | Hex color for emissive + glow |
| `state` | `'idle' \| 'active' \| 'complete' \| 'waiting'` | Drives animation |
| `position` | `[number, number, number]` | Three.js position |
| `orbIndex` | `number` | 0-4, used for phase offset in idle animation |

### `CinematicBriefing.jsx`

| Prop | Type | Description |
|---|---|---|
| `script` | `string` | Full text to stream in and read aloud |
| `voiceId` | `string` | ElevenLabs voice ID for Adam |
| `onComplete` | `() => void` | Called when both text and audio finish |

Internal behavior: On mount, calls ElevenLabs API to generate audio blob, begins playback, simultaneously begins character-by-character text streaming.

### `ConfidenceTerrain.jsx`

| Prop | Type | Description |
|---|---|---|
| `confidenceMap` | `ConfidenceMap` | Object mapping question text to score+notes |
| `visible` | `boolean` | Whether to render (controls entry animation) |

---

## Animation Reference Table

| Event | Component | Animation | Duration | Easing |
|---|---|---|---|---|
| Screen enter | All screens | Fade + scale 0.98→1 + unblur | 600ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Screen exit | All screens | Fade + scale 1→1.02 + blur | 400ms | ease-in |
| Orb activate | AgentOrb | Scale 1→1.15, glow up | 300ms | spring(stiffness:300, damping:20) |
| Orb complete | AgentOrb | Scale 1.15→1.0, glow steady | 500ms | ease-out |
| Persona change | VoiceSession | Scale shrink→0, color morph, scale 0→grow | 800ms total | ease-in / ease-out |
| Score count | Debrief | Value 0→N over 3s | 3000ms | easeOut |
| Ring fill | Debrief | Arc 0→score% over 3s | 3000ms | easeInOut |
| Terrain reveal | ConfidenceTerrain | Vertices rise from 0 over 2s | 2000ms | spring |
| Debrief card | Debrief | Fade in + translateY(10px→0) | 500ms | ease-out |
| Button pulse | CTA buttons | box-shadow oscillate | 2000ms | ease-in-out, infinite |
| Particle cluster | ParticleField | Positions interpolate toward center | per-frame | lerp 0.05 factor |
| Launch button hover | SituationInput | translateY(-1px), shadow appear | 200ms | ease |

---

## Mobile Considerations

The demo runs on a laptop/desktop. However, judges may open the URL on their phones.

- Use `min(90vw, 480px)` for container widths on narrow screens
- `ParticleField` and `Three.js` components: reduce `PARTICLE_COUNT` to 400 on mobile (`window.innerWidth < 768`)
- Voice input: still works on mobile Chrome (WebSpeech supported)
- ElevenLabs audio: works on mobile, but may require a user gesture to start playback — the "Begin Session" button serves as this gesture
- 3D terrain: can be disabled on mobile (show a 2D bar chart fallback using divs) — gate with `const isMobile = window.innerWidth < 768`
- Font sizes: scale down 15% on mobile using CSS `clamp()`

```css
/* Mobile-first fallback for key font sizes */
.score-display { font-size: clamp(48px, 10vw, 80px); }
.section-title { font-size: clamp(18px, 4vw, 28px); }
```

---

## Accessibility Minimums

Hackathon context — full WCAG 2.1 AA is not required. Minimum requirements:

- All text on background must meet **4.5:1 contrast ratio**. The design tokens satisfy this: `#F0EEF8` on `#0C0C0F` = 18.1:1.
- Focus states on all interactive elements: `outline: 2px solid #7B6CFF; outline-offset: 2px`
- The "Launch Swarm" button has `aria-disabled="true"` when disabled
- Voice recording toggle: `aria-label="Toggle voice recording"` + `aria-pressed` state
- Transcript text in Voice Session: `aria-live="polite"` for screen reader updates
- Skip the grain overlay and heavy 3D on `prefers-reduced-motion`: detect with `window.matchMedia('(prefers-reduced-motion: reduce)')` and disable Three.js animations + streaming text animations

---

## Error States

| Error | Where | Treatment |
|---|---|---|
| API call fails | Mission Control | Agent card shows "⚠ Research incomplete — proceeding with available data" in coral |
| ElevenLabs fails | Voice Session | Fall back to browser's `speechSynthesis` with a note: "Voice unavailable — using fallback" |
| WebSpeech not supported | SituationInput | Show text-only mode banner: "Your browser doesn't support voice input — type below" |
| Session response times out | Voice Session | Show "Connection interrupted" banner, offer "Retry" button |
| Debrief parse fails | Debrief | Show partial debrief with available fields, flag missing sections with "[Analysis unavailable]" |
