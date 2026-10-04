# AI Apprentice — build plan (Challenge 01, Modules 1–3)

## Context
`Elevenlabs.pdf` (Hack-Nation × ElevenLabs Challenge 01) asks for an end-to-end MVP: **Capture** (screen-share + ElevenLabs voice agent that asks *why* at natural pauses: ≥3 on-screen questions, ≥1 about a guardrail), **Map** (spoken debrief with ≥3 follow-ups not answered live, then a teach-back the expert confirms → clickable Work Map; every step and guardrail linked to a screen moment + the expert's words), **Teach** (voice tutor watches a new hire on an unseen case, catches ≥1 wrong decision *before save*, explains it with the expert's reasoning, replays the expert's moment, shows mastered / practice next).
We build the brief's **"One way to wire it"** recipe 1:1. Out of scope: stretch goals, moonshot, O*NET, WebArena, Presidio, the 5–10 min length. Demo = the brief's running example. Greenfield build in this folder. Build lean (mostly inline, no big agent fan-outs) to save credits.

## Decisions (final)
- **Stack**: Next.js 16 (App Router) + TypeScript + Tailwind, one `npm run dev` on localhost (Chrome). `@elevenlabs/react` 1.16: wrap in `<ConversationProvider>`; `useConversation()` and `useConversationClientTool(name, fn)`. `@anthropic-ai/sdk` 0.131: `client.messages.parse` + `zodOutputFormat`. Files stored in `./data/` (JSON + JPEG frames), git-ignored.
- **Vision** `claude-haiku-4-5` (env `VISION_MODEL`). **Synthesis** (draft/final Work Map, teach report): `claude-opus-5-5`, adaptive thinking, effort `medium`.
- **3 ElevenLabs agents** (interviewer, debriefer, tutor), created and updated idempotently by `scripts/setup-agents.ts` via REST. Each uses `llm: claude-sonnet-5-5` with `reasoning_effort: low`, and `tts.model_id: eleven_v3_conversational` (= Expressive Mode, which brings Scribe v2 Realtime turn-taking). Turn settings: `turn.turn_eagerness: patient`, `turn.turn_timeout: 30` (max; it can't be disabled), `conversation.max_duration_seconds: 1800`. Built-in tools: `built_in_tools.skip_turn` and `end_call`. Client tools are standalone resources (`POST /v1/convai/tools`, `type: client`) referenced via `prompt.tool_ids`. Per-session context uses dynamic variables (`dynamic_variable_placeholders` as defaults). The browser connects over WebRTC using `GET /v1/convai/conversation/token` from `/api/el-token`.
- **Recipe step 4** (Work Map → tutor), on finalize:
  - `{{work_map}}` dynamic variable (always in context).
  - KB text doc: `POST /v1/convai/knowledge-base/text`, attached in `prompt.knowledge_base` as `{type,id,name,usage_mode}`.
  - One free-form Procedure per judgment call: `POST /v1/convai/agents/{id}/branches/{main_branch_id}/procedures`, then publish with PATCH agent. Best-effort; the dynamic variable already guarantees it works.
- Guardrail lookup = **browser client tool**; **"off the record"** toggle = minimal.

## Sandbox ERP (`/erp?case=expert|newhire`)
English, € amounts, posting period 12/2026, large fonts so vision reads it reliably.
- **Layout**: invoice list with status badges; invoice "paper" (supplier, line items, net/VAT/gross, PO); coding panel with cost center select, asset no., approval route (Standard / 2nd approval: Controller); "Supplier history" (last invoices); "● Unsaved changes" indicator.
- **Actions**: Post → **confirmation modal** (the extra pause before save); Hold (reason); Send for 2nd approval.
- **Persistence**: state in localStorage, with a Reset button.
- **Cost centers**: 0400 Capex · 4711 Opex · 4720 Production materials · 4800 IT · 4910 Maintenance.
- **Expert case**:
  - 4471 Kessler Maschinenbau: CNC spindle unit, €6,480 net, default 4711. The PO shows asset requisition AN-26-0187. → recode to 0400 + asset no.
  - 4472 Brenner Industriebedarf: "Annual maintenance flat fee" €1,850, dated Dec. History shows the same text and amount already paid on 28 Nov. → Hold.
  - 4473 Strojírny Brno s.r.o. (Czech subsidiary): €3,920. → 2nd approval.
- **New-hire case** (never shown to the expert):
  - 4480 Vogt Präzisionstechnik: laser alignment system, **€7,200**, default 4711, asset requisition on the PO.
  - 4481 Strojírny Brno: €640 (tests "any amount").
  - 4482 Bürobedarf Schäfer: €212 office supplies (routine post).

## Module 1 — Capture (`/capture`)
- **Screen capture**: `getDisplayMedia` with `displaySurface: browser` and `selfBrowserSurface: exclude`; the user shares the ERP window.
- **Click-triggered capture (updated by Marc)**: no interval screenshots, visual diff loop, or screenshot heartbeats. The paired sandbox sends click notifications over a session-specific BroadcastChannel. Capture takes one screenshot after a 350 ms click debounce, with at most one analysis in flight and one pending click capture. Screenshots are JPEG ≤1280 px and sent to `/api/frame` with `analyze: true`.
- **Idle check-in**: after ≥15 s without ERP clicks, ask once whether everything is okay or the expert is thinking, once the mic and agent are quiet. Reset on the next click. Respect the question spacing and off-the-record state. Idle checking never captures a screenshot.
- **Scope**: browser screen sharing does not expose clicks in external apps. Click-triggered capture currently works with the paired sandbox tab; arbitrary apps need an extension or native event bridge.
- **Vision call** (Haiku, structured output; input = previous state + image). Returns:
  - `screen_state`: invoice, supplier, amount, cost_center, asset_no, route, status, modal, unsaved.
  - `activity`.
  - `events[]`: `{type, summary, invoice, field, from, to, decision_worthy, unanswered_why}`.
- **Events**: appended to `events.json`, shown in a live "What I see" feed, and pushed as `sendContextualUpdate("[SCREEN mm:ss] …")` (recipe step 2).
- **Conductor (when to ask)** fires an `[APP CUE]` via `sendUserMessage` only when all of these hold:
  - no ERP click ≥2.5 s;
  - mic silent ≥1.5 s (`getInputVolume`/VAD);
  - agent not speaking;
  - ≥6 s since an invoice was opened (reading time);
  - ≥20 s since the last question, and at most 5 questions per session;
  - a pending decision-worthy moment exists, preferring just after an action completes.

  The cue lists the top moments plus their `unanswered_why`. The third cue forces a guardrail question if none has been asked yet. A `user_activity` ping every 10 s stops the 30 s turn timeout from making the agent speak on its own.
- **Interviewer prompt**:
  - Default silent: call `skip_turn` on think-aloud.
  - Ask only on a cue: one question, ≤20 words, about the concrete on-screen moment; reasons, limits or exceptions, never what the screen already shows.
  - Acknowledge answers in ≤6 words; one follow-up at most.
  - First message: "work as usual, I'll ask when you pause".
- **UI**: timer, status (watching/listening/speaking/off the record), question counter (incl. guardrail ✓), transcript (cues hidden), **Off the record** (stops frames, mutes mic via `setMuted`, marks a timeline gap), **End task → Debrief**.

## Module 2 — Map (`/debrief/[id]` → `/map/[id]`)
- **`/api/workmap/draft`** (Opus; input = events + transcript with mm:ss + live Q&A). Returns:
  - draft steps / judgment calls / guardrails, using verbatim quotes;
  - **3–5 open questions**: exceptions noticed, rules it's unsure about, unseen cases (e.g. unknown supplier); each linked to a frame;
  - a teach-back outline.
- **Debrief agent** gets `{{expert_name}} {{work_map_draft}} {{open_questions}}` and client tools:
  - `show_moment(id)`: the UI shows that frame;
  - `record_answer(question_id, answer_summary, expert_quote)`;
  - `start_teachback()`;
  - `record_correction(what_i_said, correction, expert_quote)`;
  - `confirm_teachback(expert_quote)`, then `end_call`.

  Flow: ask each open question → teach-back in under 1 minute → handle corrections → explicit "yes, that's how it works".
- **`/api/workmap/final`** (Opus): merges draft + debrief answers/corrections into the Work Map JSON:
  - each step has `screenMoment{t, frame, caption}`, `decision`, `isJudgmentCall`, `reason{quote, speaker, t, source}`, `guardrailIds`;
  - each guardrail has `{kind: limit|exception|stop_and_ask|never, rule, screenMoment, quote}`;
  - plus `stats` and a confirmed teach-back.

  Code checks that every step and guardrail has a frame and a quote, then publishes to the tutor (step 4 above).
- **Work Map UI**:
  - header chips "N steps · N judgment calls · N guardrails · ✓ confirmed by Sabine";
  - clickable horizontal timeline (markers for steps, judgment calls and guardrails);
  - step card: frame + **Replay** (click-captured moments around the decision; no continuous 1 s recording), decision, reason quote ("Sabine, live question at 03:15"), guardrails with jump-to-moment;
  - Export JSON; **Start tutor**.

## Module 3 — Teach (`/teach/[workMapId]`)
- **Session setup**: the new hire (default "Lena") shares the ERP (`case=newhire`). The tutor agent gets `{{expert_name}} {{learner_name}} {{work_map}}` plus the KB doc and Procedures.
- **Vision** runs the same pipeline. Its system prompt additionally holds the Work Map rules and returns `risk{level: none|warn|stop, guardrail_id, step_id, explanation}`, judged on the **unsaved form or the open confirm modal**.
- **Cues**:
  - **PREDICT**: once per newly opened invoice, at a pause. "Which cost center would Sabine use, and why?"
  - **GUARDRAIL** (immediate, deduped per invoice + rule): the app instantly shows a red banner "Sabine would stop here" and auto-plays Sabine's replay. The tutor says "Sabine would stop here. Why do you think?", explains with her quote, and lets them fix it before posting.
  - **EXPLAIN**: after a correct step, confirm in the expert's words.
- **Tutor client tools**: `show_expert_moment(step_id)`, `lookup_guardrails(query)` (searches the Work Map), `record_outcome(ref_id, correct|corrected|missed, note)`.
- **Finish** → `/api/teach/report` (Opus) → mastery card: mastered, needs practice (with the expert quote), practice next.

## How the demo answers the Apprentice Test
1. **When to ask**: conductor fusion of screen diff, voice level, task structure, and `sendUserActivity` + `skip_turn`.
2. **What to ask**: vision flags decision-worthy events with `unanswered_why`; the prompt bans questions the screen already answers.
3. **When understood**: all open questions recorded + teach-back explicitly confirmed (tool calls).
4. **Learned**: unseen €7,200 case + mastery report.
5. **Trust**: off-the-record toggle.

## Files (new)
- `package.json`, `.env.local` (`ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`, agent IDs written by the setup script), `.gitignore`.
- `scripts/setup-agents.ts`; `agents/{capture,debrief,tutor}.md` (agent system prompts).
- `src/lib/`: `types.ts`, `store.ts`, `anthropic.ts`, `prompts/{vision,workmapDraft,workmapFinal,teachReport}.ts`, `elevenlabs.ts` (REST helpers: token, KB, procedures).
- `src/hooks/`: `useScreenCapture.ts` (frames, diff, upload), `useConductor.ts`.
- `src/app/`: `erp/`, `capture/`, `debrief/[id]/`, `map/[id]/`, `teach/[id]/`, home page with session list.
- `src/app/api/`: `frame`, `el-token`, `sessions/[id]`, `frames/[sid]/[n]`, `workmap/draft`, `workmap/final`, `workmap/[id]`, `teach/report`.
- `src/components/`: `AgentPanel`, `EventFeed`, `WorkMapTimeline`, `StepCard`, `Replay`, `MasteryReport`.

## Build order
1. Scaffold + shared types and contracts. Write `.env.local` with the ElevenLabs key you gave.
2. Sandbox ERP.
3. `/api/frame` + vision prompt. Smoke-test on ERP screenshots (Chrome automation) before any voice work, per the brief's tip "screen events first".
4. Setup script → create the 3 agents.
5. Capture page + conductor.
6. Draft, debrief, final, Work Map UI.
7. Tutor + report.
8. `npm run build` / typecheck. Self-test each API route with stored fixtures. Final checklist pass against every "Required" box in the PDF.

## What we need from you
- **Now**: nothing more. ElevenLabs key received; rotate it after the hackathon (it's in the chat log).
- **Before step 3**: an **Anthropic API key** for `.env.local`. I'll ask at that moment.
- **Live test**: Chrome with mic + screen share allowed, headphones (prevents echo), ERP window left and Apprentice window right.

## Verification (your end-to-end test)
1. `npm run dev`; open `/erp?case=expert` (left) and `/capture` (right). Share the ERP window, then Start.
2. **As Sabine**, process 4471 → 4473 while talking. ✔ The event feed shows e.g. "cost center 4711 → 0400". ✔ ≥3 spoken questions at pauses, about on-screen items, ≥1 guardrail ("…what made you do that?"). ✔ Silent while typing. ✔ Off the record pauses capture.
3. **End task** → debrief. ✔ ≥3 new follow-ups (e.g. "You held the December invoice — every supplier? who releases it?"). ✔ Teach-back under 1 minute; correct one detail; confirm.
4. **Work Map**. ✔ Clickable timeline. ✔ Each step and guardrail has a frame + replay + Sabine's quote with timestamp. ✔ About 7 steps / 3 judgment calls / 4 guardrails.
5. `/erp?case=newhire` (Reset first) → **Start tutor**.
6. **As Lena**, open 4480 (€7,200) and pick 4711 (Opex). ✔ Before you can post, the tutor says "Sabine would stop here. Why do you think?", Sabine's replay plays, and her reason is quoted. Fix to 0400 + asset no., then post.
7. **Finish**. ✔ Mastery report shows mastered vs practice next.
