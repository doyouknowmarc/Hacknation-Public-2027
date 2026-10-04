import { test } from "node:test";
import assert from "node:assert/strict";
import { cueFor, type Timing } from "../src/lib/conductor";
const ready: Timing = {
  now: 30000,
  lastClick: 26000,
  lastVoice: 27000,
  openedAt: 0,
  lastQuestion: 0,
  questions: 0,
  speaking: false,
  paused: false,
  pending: true,
  idleChecked: false,
};
test("asks about a decision only after reading, silence, and click settle", () => {
  assert.equal(cueFor(ready), "decision");
  for (const change of [
    { lastClick: 29000 },
    { lastVoice: 29000 },
    { openedAt: 26000 },
    { lastQuestion: 15000 },
    { speaking: true },
    { paused: true },
  ])
    assert.equal(cueFor({ ...ready, ...change }), null);
});
test("idle check-in waits 15 seconds, runs once, and needs no screenshot", () => {
  assert.equal(cueFor({ ...ready, pending: false, lastClick: 15000 }), "idle");
  assert.equal(cueFor({ ...ready, pending: false, lastClick: 15001 }), null);
  assert.equal(
    cueFor({ ...ready, pending: false, lastClick: 15000, idleChecked: true }),
    null,
  );
});
test("decision question cap does not disable an idle check-in", () => {
  assert.equal(cueFor({ ...ready, questions: 5 }), null);
  assert.equal(cueFor({ ...ready, questions: 5, lastClick: 10000 }), "idle");
});

test("muted microphone ignores room noise and asks once at 15 seconds", () => {
  const muted = {
    ...ready,
    micMuted: true,
    lastVoice: ready.now,
    lastQuestion: ready.now,
    pending: true,
  };
  assert.equal(cueFor({ ...muted, lastClick: 15001 }), null);
  assert.equal(cueFor({ ...muted, lastClick: 15000 }), "idle");
  assert.equal(cueFor({ ...muted, lastClick: 15000, idleChecked: true }), null);
  assert.equal(cueFor({ ...muted, lastClick: 15000, paused: true }), null);
  assert.equal(cueFor({ ...muted, lastClick: 15000, speaking: true }), null);
  assert.equal(
    cueFor({ ...muted, lastClick: 29999, idleChecked: false }),
    null,
  );
  assert.equal(cueFor({ ...muted, micMuted: false, lastClick: 15000 }), null);
});
