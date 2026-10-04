# Sensei — Capture, Map & Teach

Capture expert invoice-processing decisions with click-triggered screenshots and a voice interviewer.

Live: https://hacknation-sensei.vercel.app · ▶ **Demo** plays the one-minute story · **Open app** starts the real thing.

## How to use the app (without the demo)

Use Chrome on a laptop, with headphones and a microphone. **Open app** (`/studio`) shows the four steps in order; the highlighted card is the next one. Each run takes about 10 minutes.

1. **Capture (the expert, about 3 min).** Click **Start capture** and enter the expert's name. Optionally pick a voice and tone (*Concise* is the default). Click **Prepare session**, then **1. Open paired invoice sandbox**. It opens the expense inbox in a new tab; keep that tab open. Back on the Capture tab, click **2. Share ERP tab & start**, choose the **sandbox tab** in Chrome's dialog, and allow the microphone. Now work the inbox while thinking aloud: open an invoice, then **Approve for payment**, **Request approval** (pick an approver and add a justification) or **Hold**. Sensei stays quiet while you click and asks one short *why* question when you pause; just answer out loud. Rest the cursor in the **top-right corner** to invite Sensei's feedback, and use **Off the record** to pause everything. Finish with **End task → Debrief**.
2. **Debrief (the expert, about 3 min).** Click **Prepare debrief**; Sensei drafts 3–5 questions about what the screen couldn't show. Then either **Start voice debrief** and answer aloud, or type your answers in the fields. Sensei reads the rules back in under a minute. Correct anything that's wrong, then confirm with **Yes, this matches how I work**.
3. **Work Map.** Click **Create confirmed Work Map**. Each rule links to its screen moment and your exact words, with **Replay expert’s clicks** to see it happen. Nothing is added that you didn't say.
4. **Teach (the new hire, about 3 min).** Click **Start tutor** (or **Teach** in the top bar), enter the learner's name and **Start practice**. Click **Open new-hire ERP**, then **Share ERP tab**, and choose that tab. **Connect voice tutor** is optional; writing works too. Work the new invoice. When the learner opens a confirmation, Sensei reviews the decision *before* it can be saved. If it breaks one of the expert's rules, it stops the save, explains why with the expert's quote, and unlocks it once the form is fixed. Rest the cursor in the top-right corner to ask Sensei for a hint. **Finish practice** gives a report: what was mastered, what needs practice, and what to practise next.

**Reset demo** (on `/studio`) archives all sessions so the flow starts fresh; nothing is deleted. Tips: share the sandbox tab, not the Sensei tab; in a loud room, use **Mute microphone** or answer in writing.

## Run

```sh
npm install
npm run setup:agents
npm run dev
```

Open http://127.0.0.1:3000/capture in Chrome. Prepare a session, open its **paired invoice sandbox** link, and choose **Share ERP tab & start**. Select the ERP tab in the browser’s screen-sharing dialog and allow your microphone. Use headphones. Process invoices while thinking aloud. Use **Off the record** for a private interval, then **End task → Debrief** to save.

The supplied keys are in the ignored `.env.local`. If starting elsewhere, copy `.env.example` and fill in both API keys. The agent setup script creates/updates Capture and Debrief, their tool definitions, and prepares the tutor agent. Module 3 is available from every confirmed Work Map.

## Landing page

`/` is the public landing page (`src/app/landing.tsx`). The hero has **▶ Demo**, which opens the one-minute story full-screen over the page (✕ returns to the same scroll position), and **Open app** (`/studio`). Scrolling down: the problem (know-how walks out the door; manual vs. expert), how it works (Capture → Work Map → Teach with the Sabine/Lena example and the multilingual “Why?”), six benefits, the compounding knowledge base (new hires today, AI agents tomorrow), how it’s built, and a closing call to action. The copy follows the explainer videos in `videos/`.

## Deploying to Vercel

Run `bash scripts/vercel-env.sh` once. It logs in, creates and links the `hacknation-sensei` project, and uploads every variable from `.env.local` to production and preview, with API keys marked sensitive. The landing page and the story are static and work as is. The live app needs shared storage on Vercel, because each route can run on a different instance. Run `npx vercel integration add upstash/upstash-kv` once and connect it to `hacknation-sensei`. That provides `KV_REST_API_URL` and `KV_REST_API_TOKEN`; then redeploy. Sessions, debriefs, Work Maps and click frames are then stored in Redis (`src/lib/storage.ts`), with a per-session lock so concurrent updates from different instances don't overwrite each other. Locally, without those variables, everything stays in `data/` as before. Without Redis on Vercel, saving fails with a clear message instead of losing sessions.

## Scripted story (for the video)

The landing page (`/`, also at `/story`) is a scripted player with no live AI calls. It starts only when **Demo** is pressed and runs about 55 seconds. Sabine routes the €180 Claude invoice to the project lead, Sensei asks whether the limit is per invoice or per month, and her answer becomes a rule. Lena is stopped before approving the €90 Orion invoice (€130 this month) and routes it correctly. It ends on the slogan “Sensei, teach the next generation.” **Open app** goes to `/studio`. The older 2-minute cut is hidden; `/?full=1` shows it.

Voices use Eleven v4 voice acting (`eleven_v4_turbo`): inline `[audio tags]` direct the delivery, `...` adds pauses and CAPS add emphasis. Tags are stripped from the subtitles. Each speaker has a distinct voice, stability setting and subtitle colour:

| Speaker | Voice | Direction |
| --- | --- | --- |
| Narrator | Alice | clear, brisk, engaging |
| Sensei | Orion (library) | authoritative, kind; played at 1.12× |
| Sabine (expert) | Carol (library) | older, unhurried, knowing |
| Lena (new hire) | Jessica | curious, happy to learn |

A green full-screen slide (“Switching to Lena · the apprentice”) wipes across when the story moves to Lena, and each persona’s screen carries their colour. Library voices are used by ID, so nothing has to be added to the account. Subtitles show a coloured speaker chip with a live waveform driven by the playing audio (Web Audio analyser), and the Sensei orb glows while Sensei speaks. The script lives in `src/lib/story.ts`. After editing a line, run `npm run story:audio`; it re-renders only the lines that changed (`--force` re-renders all).

**Shareable video:** with `npm run dev` running, `npm run story:record` writes `recordings/sensei-demo-1080p.mp4` (1920×1080, 30 fps, H.264/AAC). Headless Chrome plays the story while its screencast captures frames. The soundtrack is rebuilt from the same clips at the logged start times, with Sensei at 1.12×. The video ends by holding the slogan card.

## Demo flow

The live app (`/studio`) is a single guided demo: **Capture → Debrief → Work Map → Teach**, always for the most recent expert capture. Each step shows its state and a direct link; the primary button jumps to the next open step. **Teach** in the top bar (or `/teach`) opens teacher mode for the newest confirmed Work Map.

**Reset demo** (home page) or `npm run reset:demo` moves every capture, debrief, Work Map and practice session from `data/` into `data-archive/<timestamp>/` and clears the sandbox's saved invoice state. Nothing is deleted. Each paired sandbox now keeps its invoice state per session, so a new capture always starts with fresh invoices.

### Demo storyline

“Three invoices. Three different decisions.” The expert sandbox (`/erp?case=expert`) seeds a software company's expense inbox, net amounts throughout, with the Claude limit set to €100 per project per month:

| Invoice | Case | Expert decision |
| --- | --- | --- |
| 2041 | €700 quarterly office supplies, matching PO and goods receipt | Approve for payment |
| 2042 | €180 Claude, Project Atlas (€100 allowance), urgent release | Request approval · Project lead |
| 2043 | €3,000 rent vs. €2,400 lease, no updated agreement attached | Hold · Workplace / Facilities |

The new-hire sandbox (`/erp?case=newhire`) contains a single unseen case: INV 2051, €90 Claude for Project Orion with €40 already spent this month (€130 total). The tutor should stop an “Approve for payment” before the save and ask what needs to happen before release. The four statuses are Ready for review · Awaiting approval · On hold · Approved for payment. Supporting documents show facts only. The policies come from the expert. The home page has a collapsible **Demo script** with the opening line, expected questions and answers, the debrief questions and the teaching case. Work Map steps and guardrails also record the responsible person and the release condition when the expert states them.

### Voice and tone

Capture, Debrief and Teach have **Voice** and **Tone** selectors. Voices come from your ElevenLabs account; if the list can't load, the selector falls back to the premade voices. Tone presets (Concise, the default; Balanced; Warm coach) set the agent's `{{interview_style}}` dynamic variable and speaking speed. The choice is remembered in the browser and applies when voice next connects. `npm run setup:agents` enables the voice and speed overrides on the agents.

### Help corner

Every paired sandbox, the Capture page and the Teach page have a hot corner at the top right. Rest the cursor there for ~0.7 s to invite feedback from the voice agent: during capture the apprentice shares one observation or open question (the only time it volunteers anything); during practice the tutor gives a hint grounded in the Work Map. Without voice, the tutor shows a written hint. The corner confirms whether the agent received the request, and re-arms after leaving it (8 s cooldown). Re-run `npm run setup:agents` after changing the agent prompts.

## Capture behavior

- No interval screenshots, screen-diff sampling, or screenshot heartbeats.
- A paired ERP tab broadcasts clicks on a session-specific channel. Capture waits 350 ms for the UI to settle, then uploads one JPEG of the shared screen, at most 1280 px wide, and analyzes it with Haiku.
- Rapid clicks are coalesced. Only one request runs at a time, with at most one queued click capture. Idle time produces no screenshots or vision calls.
- After 15 seconds without clicks, the agent receives one gentle check-in cue when the expert and agent are quiet. Another click resets it. Cues remain spaced by 20 seconds.
- **Mute microphone** keeps screen capture and agent playback active. It starts a fresh 15-second idle window, ignores room noise, and sends just one check-in until another ERP click. Decision questions wait while muted; the test check-in bypasses the usual question cooldown but waits for agent speech to finish. Unmute to answer. Off the record still pauses everything; resuming preserves your microphone mute choice.
- Decision cues require a 2.5-second click pause, 1.5 seconds of mic silence, 6 seconds of invoice reading time, and an idle agent. Up to five reasoning question cues; the third explicitly requests a guardrail question if needed. The displayed counts are cues, not proof of actual spoken questions.
- A voice activity ping every 10 seconds suppresses unprompted timeout speech; it never captures a screenshot.
- Off the record stops uploads and mutes the microphone. The server rejects frames/transcripts during the paused state and excludes late analysis for private intervals. Timeline gaps are preserved. Already transmitted content cannot be recalled.
- Screenshots, event JSON, transcripts and gaps are stored under ignored `data/<session-id>/`. Screenshots go to Anthropic; live voice goes to ElevenLabs. API keys stay server-side. The server listens on loopback and is intended for local use.

Screen sharing does not expose clicks in external apps. This implementation supports click notifications from the **paired sandbox tab only**. An extension/native event bridge is needed for arbitrary applications. The browser cannot verify that you selected the paired tab; select it carefully.

## Validation

```sh
npm test
npm run typecheck
npm run build
npm run smoke
npm run smoke -- --vision
```

The vision smoke command sends the included synthetic ERP screenshot fixture to Anthropic (one paid analysis). Smoke checks create an isolated test session and remove that session afterwards. They verify frame serving, paused/ended rejection, transcript exclusion, private gaps, and voice token issuance.

Verified in Chrome: recoding, confirmation before posting, persisted posted state on reload, duplicate hold with required reason, Controller approval, and paired-tab readiness. Vision recognized invoice 4471, Capex coding and the posting modal from the actual rendered ERP fixture. Live microphone/screen-share recording and spoken cue timing still require a user test.

## Module 2: Debrief → Work Map

End a capture and open its debrief page (saved captures on the home page link there). **Prepare debrief** uses Opus with medium effort to create a cached draft and 3–5 new questions. A capture must be ended and have analyzed screen events. Short captures can produce questions about the same moment; no observations or expert policies are fabricated to pad the map.

Choose **Start voice debrief**. The agent shows each screen moment, records an answer with a verbatim quote, gives a teach-back under one minute, records corrections, and asks for a fresh explicit affirmative confirmation. Its five client tools persist progress to the server. Microphone mute and Stop voice are available. Reconnecting supplies saved answers and corrections so the agent can resume.

For a noisy room, answer in the text fields instead. Save every answer, review the observed supported steps and exact answers, add any corrections, then explicitly click **Yes, this matches how I work**. This is an alternative to the spoken test, not evidence that spoken tool timing passed.

After confirmation, **Create confirmed Work Map** runs Opus once. Each step and guardrail must reference an actual observed event, an existing frame, and a verbatim quote in an expert transcript entry; private timeline intervals and apprentice statements are rejected. Unsupported steps are omitted and gaps listed as limitations. Statistics come from validated output, not the model.

The Work Map has clickable step/judgment/guardrail markers, linked screenshots, nearby click-frame replay, source-aware quote timestamps, expert confirmation, and JSON export. Older captures recover replay times from their observed events; new captures store an explicit click-frame manifest. No continuous video or 1-second frames are generated.

Finalization saves the map locally before preparing the tutor: one knowledge text document, a free-form Procedure per judgment call, and an agent version publish. Failures remain visible and retryable without rerunning synthesis. Every procedure is scoped to the active map ID. Module 3 provides the active Work Map as a dynamic variable and scopes its guardrail search and replay to that map.

Draft/final requests are cached and coalesced to avoid duplicate paid synthesis. Debrief records and Work Maps live beside the capture under ignored `data/<session-id>/`. All remote publication is to your ElevenLabs workspace, not a public website.

### Voice shutdown diagnosis

The reported connection-state mismatch came from the SDK's LiveKit transport health check observing a closed engine. Capture requests succeeded and the session was saved as ended. Our React controls API returns immediately from `endSession()`; awaiting it did not wait for teardown. The Capture → Debrief handoff and Module 2 Stop voice/finalize now await the raw conversation's real shutdown promise before navigating. This removes the application’s immediate-navigation race. The SDK’s WebRTC `close()` also starts LiveKit `room.disconnect()` without awaiting it, so the raw shutdown promise does not guarantee transport completion and a teardown warning may still occur. Logs are not suppressed, and an unexpected disconnect remains visible.

### Module 2 validation

The tests cover saved answer gates, invented/misattributed quote rejection, missing/private moment rejection, corrections, qualified/stale confirmation rejection, and persisted confirmation. The production build and typecheck cover all new routes. `scripts/verify-module2.ts` creates a clearly labeled synthetic session and runs a paid draft call through the local server; do not confuse that fixture with a real expert capture. Browser and remote API checks are recorded in `docs/module2-validation.md`. Live microphone debrief, spoken duration and voice tool timing remain a user test.



## Module 3: Work Map → Tutor → Practice report

Open a confirmed Work Map and choose **Start tutor**. Start practice with a learner name, open its **new-hire ERP** link in Chrome, then **Share ERP tab** and select that exact tab. Connect the voice tutor if desired; writing and screen checks also work without voice. Click an invoice to begin. Never choose the Capture tab or a different ERP invoice tab when sharing. The tutor checks that the visible invoice matches the paired invoice before releasing confirmation.

The tutor asks for a prediction once per opened invoice, flags risks against the confirmed map, and shows the linked expert quote and click-frame replay. Unknown policies and map contradictions are presented as uncertainties; the tutor does not fill gaps with a demo answer. Only clicked frames are analyzed. Microphone mute preserves a fresh 15-second no-click check-in window and ignores background speech; the check-in is sent once until another click. No idle screenshot calls are made.

Posting, holding, and sending to the Controller use confirmation dialogs in the paired teaching sandbox. Confirmation remains disabled until the current visible form receives a safe review. Editing fields, changing the invoice, or reopening a dialog invalidates the prior review. Slow analysis, an unavailable tutor, a wrong shared tab, or a failed model response keeps confirmation blocked. The server verifies the latest review and revision again when saving. The sandbox is isolated per practice session and never performs real financial transactions.

A safe review grants permission to save. It does **not** establish a learning outcome. After saving, the next click-triggered screenshot must show the completed invoice status with the confirmation dialog closed before a successful outcome is recorded. A decision following feedback counts as corrected. **Finish practice** stops capture and voice, saves the session, and produces a cached Opus report: mastered, needs practice with exact quotes, and practice next. Refresh restores the current practice or saved report. If a report fails, its button retries without losing evidence.

The tutor's three client tools are `show_expert_moment`, `lookup_guardrails`, and `record_outcome`. Updating its setup preserves the published knowledge base and Procedures. `data/<practice-id>/session.json` stores map ID, learner, screen checks, outcomes, transcripts, and report alongside click frames. Practice sessions are separate from expert captures and are omitted from the home capture list.

### Voice connection compatibility fix

The reported signal-stream error originated in `livekit-client` 2.22.3. ElevenLabs documents a temporary `livekit-client` **2.16.1** override for its WebRTC server compatibility; this project now uses that exact version in the lockfile. The newer signal-reader error path is absent in the pinned build. See [ElevenLabs' compatibility guidance](https://github.com/elevenlabs/plugin/blob/main/skills/general/agents/SKILL.md#temporary-livekit-websocket-pin). Existing awaited voice shutdown and visible unexpected-disconnect handling remain. A live voice start/stop test is still needed to verify behavior in the user's room and browser; no console errors are hidden.

### Module 3 validation

`npm test` checks risky/stale/ended save rejection, supported outcome provenance, safe-review-versus-completed-save distinction, correction tracking, and exact report quote hydration, plus the existing capture/debrief checks. The production build and typecheck cover all teaching routes. Actual browser screenshots were sent to Haiku: an unseen €7,200 invoice was stopped against the confirmed test map, and holding it for a missing asset number was approved. A real Opus report was generated, recovered twice from cache, and correctly withheld mastery because saving was not observed. See `docs/module3-validation.md` for limits and fixture IDs. The screen-share picker and live spoken tutor still require a Chrome user test.
