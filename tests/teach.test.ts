import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import {
  createSession,
  mutateSession,
  sessionDir,
  readSession,
} from "../src/lib/store";
import { writeFile } from "../src/lib/workmap-store";
import {
  canRelease,
  recordOutcome,
  validateRisk,
  hydrateReport,
  observeCompletion,
} from "../src/lib/teach";
import { PATCH } from "../src/app/api/teach/[id]/route";
import { POST as start } from "../src/app/api/teach/route";
import type { WorkMap } from "../src/lib/workmap-types";
import type { TeachCheck, Teaching } from "../src/lib/teach-types";
const mapId = randomUUID();
const reason = {
  quote: "The €100 limit is total monthly spend per project, including earlier invoices.",
  speaker: "Expert",
  t: 1,
  source: "live" as const,
  evidenceId: randomUUID(),
};
const map = {
  id: mapId,
  sessionId: mapId,
  expert: "Expert",
  guardrails: [
    {
      id: "g1",
      kind: "limit",
      rule: "Claude spend above €100 per project per month needs project lead approval",
      reason,
      quote: reason.quote,
      screenMoment: {
        id: randomUUID(),
        t: 1,
        frame: "/frame",
        caption: "Expert requests project lead approval",
      },
    },
  ],
  steps: [],
  limitations: [],
} as unknown as WorkMap;
const check = (risk: "none" | "stop", t = 1): TeachCheck => ({
  id: randomUUID(),
  t,
  frame: "/frame",
  revision: `rev-${t}`,
  invoice: "2051",
  action: "approve",
  status: "Ready for review",
  modal: "Confirm approval for payment",
  risk: {
    level: risk,
    guardrail_id: "g1",
    step_id: null,
    explanation: "Observed routing decision",
  },
});
test("review gate rejects risks, altered forms and screens without a save action", () => {
  const c = check("none");
  assert.equal(canRelease(c, c.revision), true);
  assert.equal(canRelease(c, "changed"), false);
  assert.equal(canRelease(check("stop"), "rev-1"), false);
  assert.equal(canRelease({ ...c, action: null }, c.revision), false);
  assert.throws(() =>
    validateRisk({ ...c.risk, guardrail_id: "invented" }, map),
  );
});
test("practice evidence cannot turn a caught error into independent mastery", () => {
  const risky = check("stop"),
    safe = { ...check("none", 2), committed: true };
  const t: Teaching = {
    mapId,
    learner: "Test",
    checks: [risky, safe],
    outcomes: [],
    report: null,
  };
  assert.throws(() =>
    recordOutcome(t, map, {
      refId: "g1",
      result: "correct",
      note: "Wrong",
      checkId: risky.id,
    }),
  );
  recordOutcome(t, map, {
    refId: "g1",
    result: "corrected",
    note: "Routed after feedback",
    checkId: safe.id,
  });
  assert.throws(() =>
    hydrateReport(
      {
        summary: "Done",
        mastered: [{ refId: "g1", explanation: "Mastered" }],
        needsPractice: [],
        practiceNext: ["Route another invoice"],
        limitations: [],
      },
      t,
      map,
    ),
  );
  const r = hydrateReport(
    {
      summary: "Practice needed",
      mastered: [],
      needsPractice: [{ refId: "g1", explanation: "Corrected with help" }],
      practiceNext: ["Route another invoice"],
      limitations: [],
    },
    t,
    map,
  );
  assert.equal(r.needsPractice[0].quote, reason.quote);
});
test("persisted API blocks stale and risky commits and records linked corrections", async () => {
  const expert = await createSession("Test fixture"),
    practice = await createSession("Test learner");
  try {
    await writeFile(expert.id, "workmap", {
      ...map,
      id: expert.id,
      sessionId: expert.id,
    });
    const bad = check("stop"),
      good = check("none", 2);
    await mutateSession(practice.id, (s) => {
      s.teaching = {
        mapId: expert.id,
        learner: "Test",
        checks: [bad],
        outcomes: [],
        report: null,
      };
    });
    const patch = (b: object) =>
      PATCH(
        new Request("http://localhost/api/teach", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(b),
        }),
        { params: Promise.resolve({ id: practice.id }) },
      );
    assert.equal(
      (
        await patch({
          action: "commit",
          checkId: bad.id,
          revision: bad.revision,
        })
      ).status,
      400,
    );
    await mutateSession(practice.id, (s) => {
      s.teaching!.checks.push(good);
    });
    assert.equal(
      (
        await patch({
          action: "commit",
          checkId: bad.id,
          revision: bad.revision,
        })
      ).status,
      400,
    );
    assert.equal(
      (await patch({ action: "commit", checkId: good.id, revision: "changed" }))
        .status,
      400,
    );
    assert.equal(
      (
        await patch({
          action: "commit",
          checkId: good.id,
          revision: good.revision,
        })
      ).status,
      200,
    );
    assert.equal((await readSession(practice.id)).teaching!.outcomes.length, 0);
    await mutateSession(practice.id, (s) => {
      observeCompletion(s.teaching!, map, {
        ...check("none", 3),
        action: null,
        modal: null,
        status: "Approved for payment",
      });
    });
    assert.equal(
      (await readSession(practice.id)).teaching!.outcomes[0].result,
      "corrected",
    );
    await mutateSession(practice.id, (s) => {
      s.status = "ended";
    });
    assert.equal(
      (
        await patch({
          action: "commit",
          checkId: good.id,
          revision: good.revision,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await start(
          new Request("http://localhost/api/teach", {
            method: "POST",
            body: JSON.stringify({ mapId: randomUUID(), learner: "No map" }),
          }),
        )
      ).status,
      400,
    );
  } finally {
    await rm(sessionDir(expert.id), { recursive: true, force: true });
    await rm(sessionDir(practice.id), { recursive: true, force: true });
  }
});
