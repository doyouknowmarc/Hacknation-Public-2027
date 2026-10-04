# Module 3 validation — 4 October 2026

Implemented /teach/[mapId], practice persistence/recovery, click-triggered learned-rule vision, tutor voice tools, prediction/risk/explanation cues, expert evidence/replay, microphone mute and one 15-second idle check-in, pre-save sandbox gating, and cached Opus practice reports.

## Automated checks

- Eight tests pass: existing conductor/debrief coverage plus risky, changed, outdated and ended-session commit rejection; provenance-linked outcomes; corrections withheld from mastery; approval alone creates no outcome; only an observed completed status with no modal credits a saved action; exact expert quote hydration.
- TypeScript and production build pass, including all teaching endpoints and pages.
- LiveKit resolved version is 2.16.1 (override), replacing 2.22.3 according to ElevenLabs compatibility guidance. The new signal-stream logger responsible for the supplied error is not in this version. This is not proof of live voice shutdown correctness.
- Tutor agent setup succeeded with three configured client tools. Existing Work Map knowledge and Procedures were preserved.

## Browser + real model checks

- The actual paired ERP displayed invoice 4480, €7,200, 4711 / no asset / Standard. Confirm & post stayed disabled before review, including after rapid clicks.
- Confirmation now includes supplier, description, PO/requisition, history, net amount, and current coding so they remain readable in the screen image.
- The user's real map (`4843cf9a-8a57-4b71-b480-cdfa2251a823`) preserved its uncertainty about cost-center validation. A real Haiku check blocked posting with a clarification warning; it did not invent a capitalization policy. Its verified published map was untouched.
- The explicitly synthetic confirmed test map (`da1d7d84-141a-4961-aa3c-dc32eb7357aa`, expert `Sabine · test fixture`) generalized its €6,000 rule to the unseen €7,200 invoice: risk STOP, guardrail-1 / step-2, before confirmation. The server rejected its commit.
- Haiku initially returned an invented reference. The output schema now constrains references to exact active-map IDs, in addition to server validation.
- A corrected hold request with no verified asset number passed Haiku review (NONE, guardrail-7 / step-4) and server permission. The prompt explicitly distinguishes the safety of holding from the unresolved asset details.
- Test practice `ef984826-1ad5-4fa1-85fc-c35afa0de995` generated a real Opus report. It contains linked exact quotes, needs-practice items and concrete next tasks; mastered is empty because no completed save was observed. Repeated report requests returned the same cached object without new synthesis.
- Screenshots: teach-posting-gate.jpg and teach-hold-review.jpg. These show test sandbox data.

## Remaining live verification

The in-app browser opened the screen-share picker, but a paired-tab capture was not completed there. Use Chrome, select the paired new-hire tab, and exercise live screen checks, correction, saved status, replay and spoken explanations. Reconnect/stop voice to confirm the compatibility pin removes the supplied error in the real voice session. Verify spoken prediction, mute/15-second check-in and correction timing. Tests and direct screenshot uploads do not establish these live behaviors.

No continuous screenshots, arbitrary-app click capture, real financial writes, public hosting, invented expert policy, or hidden console filtering are used.
