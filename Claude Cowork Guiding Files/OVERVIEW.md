# SWARM — Product Overview
> Version: 1.0 | Built at Los Altos Hacks X — April 11–12, 2026

---

## What Swarm Is

Swarm is an adaptive multi-agent AI system that prepares you for any high-stakes conversation — before you walk into the room.

The premise: every high-stakes situation is unique. The MIT admissions officer who interviews one candidate is not the same as the one who interviews another. The VC who has seen 40 pitches this week has different friction points than the one who just met a founder like you for the first time. The problem with every existing interview prep tool is that they give everyone the same generic pre-scripted agents. They simulate the average scenario, not your scenario.

Swarm solves this by doing something no existing product does: it builds its agents from scratch for you, using live web research, every single time. The agents that simulate your MIT interview are different from the agents that simulate someone else's MIT interview, because they were built by searching the internet right now for what MIT interviewers have actually said and done in the last six months.

---

## The Product in Plain Language — MIT Interview Walkthrough

You open Swarm. One text field. You type:

> "MIT CS interview in 2 days — I always freeze on 'why MIT' and I went to a small public school with no research experience"

You click "Launch Swarm."

**What happens next:**

Five AI agents wake up simultaneously, each visible on screen as a glowing 3D orb, working in real time. You can watch them:

- The **Researcher** is live-searching Reddit r/MITAdmissions, College Confidential, YouTube interview breakdowns, and recent applicant blogs. It finds that MIT interviewers in 2025–2026 have consistently pushed back on generic "I love research" answers and specifically rewarded candidates who can name a specific MIT lab and explain why their work connects to it. It finds a quote from an interviewer: "I can always tell who Googled us the night before."

- The **Profiler** builds a psychological portrait of who typically interviews for MIT CS: alumni volunteers aged 30–55, disproportionately working in systems, hardware, or applied math, high standard for intellectual honesty, allergic to performance, drawn in by unexpected angles and intellectual courage.

- The **Weak Spot Finder** reads your stated gap — "I always freeze on why MIT" — and deconstructs why this happens: generic "why X" answers fail because they list facts rather than reveal desire. It builds three response frameworks you should practice: the Specific Pull framework ("I read Professor X's work on Y and..."), the Contrast frame ("At my school we couldn't do Z, so MIT is the only place where..."), and the Honest Admission frame ("I'll tell you the exact moment I knew it had to be MIT...").

- The **Voice Designer** specifies how your interviewer should sound: warm but probing, speaks in measured sentences, uses silence as a tool after difficult questions, occasionally pushes back with a quiet "really?" rather than aggressive challenge.

- The **Architect** reads all four outputs and designs a session that starts with a rapport question ("Tell me about something you're working on outside of school"), moves to your weakness ("So — why MIT specifically?"), pivots to a pressure test ("If MIT rejects you, what's your plan?"), then ends with an unexpected curveball ("What would you do if you got in and hated it?").

Now the orbs arrange into a panel. A voice speaks — warm, a slight East Coast edge, measured pace. "Tell me about something you've been obsessing over lately that isn't on your application."

You speak. The system listens. Your answer lands well. The voice moves forward. Then it hits the hard question. "Why MIT specifically?" You stumble. The Skeptic orb flares. A second voice cuts in, cooler, more clipped: "I hear that a lot. What would you say that isn't on the website?" You recover. The session pushes for twelve minutes.

Then: a black screen. Text streams in. A voice — cinematic, unhurried — reads it as it appears. Your clarity score: 71. Your best moment: when you said "I don't care about the brand — I need those specific professors." Your worst moment: the first four seconds of "why MIT" where your voice went flat and you lost the room.

You close Swarm and walk into your interview knowing exactly what to fix.

---

## The Demo Moment

This is the most important paragraph in this document. **The live demo is the product.**

On stage, a team member opens Swarm in front of the judges. They type:

> "I'm about to pitch an AI hackathon project called Swarm to a panel of Silicon Valley judges from HPE, Palantir, and Yahoo — I need to defend the technical architecture and answer hard 'why not just use ChatGPT' questions"

They click Launch Swarm. The judges watch five orbs wake up and research their own hackathon in real time. They watch the system build a panel of VC-hardened, Silicon Valley-fluent judges — because it just searched the internet for what those judges care about.

The session runs for 90 seconds. The Skeptic voice pushes back: "What happens when OpenAI ships this natively?" The answer is practiced. The debrief rolls. The clarity score appears.

The pitch then ends with: "We didn't practice this pitch on a generic interview bot. We practiced it on a swarm built from live research about this exact event, with the exact type of judges sitting in front of us right now."

This is the demo. Everything in the build must make this demo land.

---

## What Makes Swarm Different

### Every Existing Tool Is Generic

| Tool | What They Do | Why It Falls Short |
|---|---|---|
| Yoodli | AI speech coach with generic question banks | Same questions for every user, no situational research |
| ToughTongue | AI role-play with fixed personas | Pre-scripted agents, no live research, one voice |
| VirtualSpeech | VR interview practice | Fixed environments, no adaptation to your gap |
| Big Interview | Video practice with canned feedback | Template feedback, zero customization |
| ChatGPT | Custom roleplay via prompt | No multi-agent coordination, no ElevenLabs voice separation, no structured debrief |

### Swarm's Defensible Core

**Situation-specific agent generation via live web research is the feature no one else has.**

The technical moat: combining live Tavily search results with per-agent Claude system prompts that produce structured agent profiles, then passing those profiles as context to ElevenLabs-voiced personas in a real-time multi-agent conversation session is a pipeline no existing consumer product has shipped.

The product moat: every session is a new artifact. Users will run multiple sessions for the same scenario as they improve — Swarm will surface cross-session patterns. "Your clarity on 'why this company' questions has improved 22 points since your first session. Your momentum still breaks on pressure questions."

---

## Definition of V1 Success

**Minimum viable demo (must have for stage):**
- Phase 1 works: user can type a situation, hit Launch Swarm
- Phase 2 works: 5 orbs appear, 5 agent research streams return real output, not mocked
- Phase 3 works: at least 2 distinct ElevenLabs voices conduct a real voice session, WebSpeech input captures user speech, judge orchestrator routes between personas
- Phase 4 (basic): debrief text appears with clarity score and 2–3 feedback points

**V1 Stretch (ship if time allows):**
- Full 4-phase flow with cinematic debrief voice and all 3D visuals
- Confidence terrain 3D visualization
- Ask Your Past Session
- Pattern Intelligence across sessions
- Full mobile responsiveness

**What failure looks like (and what to do about it):**
See RISKS.md and TESTING.md for fallback strategies. The rule is: always have a recorded backup demo. Always.

---

## Who It's For

Swarm is for anyone in the 72-hour window before a high-stakes conversation they cannot afford to lose:

- **College admissions** — MIT, Stanford, Harvard, HYPSM interviews
- **FAANG / technical** — Engineering panels, system design rounds, behavioral loops
- **VC / investor pitches** — Seed-stage founders about to walk into Sequoia
- **Salary negotiation** — Preparing for a raise conversation with a manager
- **Debate / speech** — Competitive debaters stress-testing arguments
- **Medical school** — MMI-style multiple mini-interview prep
- **Difficult personal conversations** — Parents, partners, anyone where the stakes are emotional

The product works for any of these because the situational input drives everything. The agents don't know they're practicing an MIT interview until you tell them. The same infrastructure serves all scenarios.

---

## Team & Hackathon Context

- **Event:** Los Altos Hacks X — April 11–12, 2026 (24 hours)
- **Team size:** 2
- **Division of labor:** Backend/agents (Claude Code) + Frontend 3D visuals (Lovable + Claude Code)
- **Target prize tracks:** Best Use of ElevenLabs, Best Use of Gen AI, Best .Tech Domain
- **Judges:** Silicon Valley engineers and PMs from HPE, Palantir, Yahoo

The demo slot is 3 minutes. Every build decision should optimize for a 3-minute live demo that works flawlessly and reads as instantly impressive to a technical audience.
