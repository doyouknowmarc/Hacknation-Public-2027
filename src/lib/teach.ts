import type { WorkMap } from "./workmap-types";
import type {
  Teaching,
  TeachCheck,
  Outcome,
  Risk,
  TeachReport,
} from "./teach-types";
import { reportSchema } from "./teach-types";
import { z } from "zod";
import { ACTION_STATUS, COMPLETED } from "./invoices";
export function mapReference(map: WorkMap, id: string) {
  return (
    map.guardrails.find((g) => g.id === id) ||
    map.steps.find((s) => s.id === id)
  );
}
export function validateRisk(risk: Risk, map: WorkMap): Risk {
  if (
    risk.guardrail_id &&
    !map.guardrails.some((g) => g.id === risk.guardrail_id)
  )
    throw new Error("Vision referenced an unknown guardrail");
  if (risk.step_id && !map.steps.some((g) => g.id === risk.step_id))
    throw new Error("Vision referenced an unknown step");
  if (risk.level === "stop" && !risk.guardrail_id && !risk.step_id)
    throw new Error("A stop must reference learned evidence");
  return risk;
}
export function canRelease(check: TeachCheck, revision: string) {
  return (
    check.revision === revision &&
    check.risk.level === "none" &&
    !!check.invoice &&
    !!check.action
  );
}
export function recordOutcome(
  t: Teaching,
  map: WorkMap,
  p: {
    refId: string;
    result: Outcome["result"];
    note: string;
    checkId: string;
  },
) {
  if (!mapReference(map, p.refId))
    throw new Error("Unknown Work Map reference");
  const check = t.checks.find((c) => c.id === p.checkId);
  if (!check) throw new Error("Outcome requires an observed screen check");
  const linked =
    check.risk.guardrail_id === p.refId || check.risk.step_id === p.refId;
  if (!linked)
    throw new Error("The screen check does not support that reference");
  if (
    p.result !== "missed" &&
    !check.committed &&
    (check.modal !== null ||
      !COMPLETED.test(check.status || ""))
  )
    throw new Error(
      "A successful outcome requires a committed or visibly completed action",
    );
  if (p.result === "missed" && check.risk.level !== "stop")
    throw new Error("A missed outcome requires an observed rule violation");
  if (p.result === "correct" && check.risk.level !== "none")
    throw new Error("An unsafe decision cannot be recorded as correct");
  if (p.result === "corrected") {
    if (
      check.risk.level !== "none" ||
      !t.checks.some(
        (c) =>
          c.t < check.t &&
          c.invoice === check.invoice &&
          c.risk.level !== "none",
      )
    )
      throw new Error(
        "A correction requires an earlier risk and a later safe check",
      );
  }
  if (
    p.result === "correct" &&
    t.checks.some(
      (c) =>
        c.t < check.t && c.invoice === check.invoice && c.risk.level !== "none",
    )
  )
    throw new Error(
      "A decision made after feedback must be recorded as corrected",
    );
  const existing = t.outcomes.find(
    (o) => o.checkId === p.checkId && o.refId === p.refId,
  );
  if (existing) return existing;
  const row: Outcome = { ...p, id: crypto.randomUUID(), t: check.t };
  t.outcomes.push(row);
  return row;
}
export function hydrateReport(
  input: z.infer<typeof reportSchema>,
  t: Teaching,
  map: WorkMap,
): TeachReport {
  const seen = new Set<string>();
  function items(
    rows: { refId: string; explanation: string }[],
    mastered: boolean,
  ) {
    return rows.map((row) => {
      const ref = mapReference(map, row.refId);
      if (!ref || seen.has(row.refId))
        throw new Error("Invalid or duplicate report reference");
      seen.add(row.refId);
      if (
        mastered &&
        (!t.outcomes.some(
          (o) => o.refId === row.refId && o.result === "correct",
        ) ||
          t.outcomes.some(
            (o) => o.refId === row.refId && o.result !== "correct",
          ) ||
          t.checks.some(
            (c) =>
              c.risk.level !== "none" &&
              (c.risk.guardrail_id === row.refId ||
                c.risk.step_id === row.refId),
          ))
      )
        throw new Error(
          "Mastery requires observed independent correct work without a recorded mistake",
        );
      return {
        refId: row.refId,
        title: "rule" in ref ? ref.rule : ref.decision,
        explanation: row.explanation,
        quote: ref.reason.quote,
        speaker: ref.reason.speaker,
        frame: ref.screenMoment.frame,
      };
    });
  }
  const mastered = items(input.mastered, true);
  const needsPractice = items(input.needsPractice, false);
  for (const check of t.checks.filter((c) => c.risk.level !== "none"))
    for (const id of [check.risk.guardrail_id, check.risk.step_id]) {
      if (id && !seen.has(id))
        needsPractice.push(
          ...items([{ refId: id, explanation: check.risk.explanation }], false),
        );
    }
  return {
    createdAt: new Date().toISOString(),
    summary: input.summary,
    mastered,
    needsPractice,
    practiceNext: input.practiceNext,
    limitations: [...new Set([...map.limitations, ...input.limitations])],
  };
}

export function observeCompletion(
  t: Teaching,
  map: WorkMap,
  completed: TeachCheck,
) {
  if (completed.modal !== null) return;
  const review = [...t.checks].reverse().find(
    (c) =>
      c.invoice === completed.invoice &&
      c.approved &&
      !c.committed &&
      ACTION_STATUS[c.action || ""]?.toLowerCase() ===
        completed.status?.toLowerCase(),
  );
  if (!review) return;
  review.committed = true;
  const refId = review.risk.guardrail_id || review.risk.step_id;
  if (!refId) return;
  const corrected = t.checks.some(
    (c) =>
      c.t < review.t && c.invoice === review.invoice && c.risk.level !== "none",
  );
  recordOutcome(t, map, {
    refId,
    result: corrected ? "corrected" : "correct",
    note: `Observed invoice ${completed.invoice} ${completed.status} after a screen-reviewed ${review.action} decision`,
    checkId: review.id,
  });
}
