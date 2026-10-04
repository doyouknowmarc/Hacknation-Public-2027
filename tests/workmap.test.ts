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
import { writeFile, readDebrief } from "../src/lib/workmap-store";
import { hydrateMap, assertDraft } from "../src/lib/evidence";
import { PATCH } from "../src/app/api/debrief/[id]/route";
import type { Debrief, FinalInput } from "../src/lib/workmap-types";
test("debrief gates, quote provenance, corrections, and confirmation survive persistence", async () => {
  const s = await createSession("Verification");
  try {
    const momentId = randomUUID();
    await mutateSession(s.id, (s) => {
      s.status = "ended";
      s.events.push({
        id: momentId,
        t: 2,
        frame: `/api/frames/${s.id}/0`,
        type: "coding",
        summary: "Cost center selected",
        invoice: "4471",
        field: "cost_center",
        from: "4711",
        to: "0400",
        decision_worthy: true,
        unanswered_why: "Why Capex?",
      });
    });
    const d: Debrief = {
      sessionId: s.id,
      createdAt: new Date().toISOString(),
      draft: {
        title: "Test",
        steps: [],
        guardrails: [],
        teachbackOutline: [],
        openQuestions: [1, 2, 3].map((i) => ({
          id: `q-${i}`,
          momentId,
          question: `Rule ${i}?`,
          whyNeeded: "Missing reasoning",
        })),
      },
      transcript: [],
      answers: [],
      corrections: [],
      phase: "questions",
      teachbackStartedAt: null,
      confirmed: null,
    };
    await writeFile(s.id, "debrief", d);
    const patch = async (body: object) =>
      PATCH(
        new Request("http://localhost/api/debrief", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: s.id }) },
      );
    const say = async (text: string, t: number, source = "user") => {
      const id = randomUUID();
      assert.equal(
        (await patch({ action: "transcript", id, t, source, text })).status,
        200,
      );
      return id;
    };
    assert.equal((await patch({ action: "start_teachback" })).status, 400);
    assert.equal(
      (await patch({ action: "confirm_teachback", expert_quote: "Yes" }))
        .status,
      400,
    );
    for (let i = 1; i <= 3; i++) {
      await say(`Rule ${i}: ask the Controller.`, i);
      assert.equal(
        (
          await patch({
            action: "record_answer",
            question_id: `q-${i}`,
            answer_summary: "Invented summary",
            expert_quote: "Invented quote",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await patch({
            action: "record_answer",
            question_id: `q-${i}`,
            answer_summary: "Ask Controller",
            expert_quote: `Rule ${i}: ask the Controller.`,
          })
        ).status,
        200,
      );
    }
    assert.equal((await patch({ action: "start_teachback" })).status, 200);
    await say("Yes, but any amount needs approval.", 4);
    assert.equal(
      (await patch({ action: "confirm_teachback", expert_quote: "Yes" }))
        .status,
      400,
    );
    assert.equal(
      (
        await patch({
          action: "record_correction",
          what_i_said: "Only high amounts",
          correction: "Any amount",
          expert_quote: "any amount needs approval.",
        })
      ).status,
      200,
    );
    assert.equal(
      (await patch({ action: "confirm_teachback", expert_quote: "Yes" }))
        .status,
      400,
    );
    const confirmId = await say("Yes, that is correct.", 5);
    assert.equal(
      (
        await patch({
          action: "confirm_teachback",
          expert_quote: "Yes, that is correct.",
        })
      ).status,
      200,
    );
    const saved = (await readDebrief(s.id))!;
    assert.equal(saved.confirmed?.evidenceId, confirmId);
    assert.equal(saved.corrections.length, 1);
    const input: FinalInput = {
      title: "Workflow",
      steps: [
        {
          id: "s1",
          momentId,
          decision: "Ask Controller",
          isJudgmentCall: true,
          reason: {
            evidenceId: saved.answers[0].evidenceId,
            quote: "ask the Controller.",
          },
          guardrailIds: ["g1"],
          owner: "Controller",
          releaseCondition: null,
        },
      ],
      guardrails: [
        {
          id: "g1",
          momentId,
          kind: "stop_and_ask",
          rule: "Any amount needs approval",
          reason: {
            evidenceId: saved.corrections[0].evidenceId,
            quote: "any amount needs approval.",
          },
          owner: null,
          releaseCondition: "Controller approved",
        },
      ],
      limitations: [],
    };
    const session = await readSession(s.id);
    const map = hydrateMap(input, session, saved);
    assert.equal(map.steps[0].reason.source, "debrief");
    assert.equal(map.guardrails[0].screenMoment.frame, `/api/frames/${s.id}/0`);
    assert.equal(map.stats.guardrails, 1);
    assert.throws(
      () =>
        hydrateMap(
          { ...input, steps: [{ ...input.steps[0], momentId: "missing" }] },
          session,
          saved,
        ),
      /moment/,
    );
    assert.throws(
      () =>
        hydrateMap(
          {
            ...input,
            steps: [
              {
                ...input.steps[0],
                reason: {
                  evidenceId: saved.answers[0].evidenceId,
                  quote: "Fabricated words",
                },
              },
            ],
          },
          session,
          saved,
        ),
      /quote/,
    );
    assert.throws(
      () =>
        hydrateMap(
          {
            ...input,
            steps: [{ ...input.steps[0], guardrailIds: ["unknown"] }],
          },
          session,
          saved,
        ),
      /guardrail/,
    );
    assert.throws(
      () =>
        hydrateMap(input, { ...session, gaps: [{ start: 1, end: 3 }] }, saved),
      /private/,
    );
    assert.throws(
      () => hydrateMap(input, session, { ...saved, confirmed: null }),
      /confirmation/,
    );
    assert.throws(
      () =>
        assertDraft(
          {
            ...d.draft,
            steps: [
              {
                id: "s1",
                momentId,
                decision: "Wrong",
                isJudgmentCall: true,
                reason: { evidenceId: confirmId, quote: "Yes" },
              },
            ],
          },
          session,
        ),
      /quote/,
    );
  } finally {
    await rm(sessionDir(s.id), { recursive: true, force: true });
  }
});
