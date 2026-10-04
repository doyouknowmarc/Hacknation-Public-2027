import type { Session } from "./types";
import type {
  Debrief,
  Draft,
  Evidence,
  FinalInput,
  WorkMap,
} from "./workmap-types";
export const normalize = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, " ").trim();
export function evidenceFor(s: Session, d?: Debrief): Evidence[] {
  return [
    ...s.transcript
      .filter(
        (t) =>
          t.source === "user" &&
          !s.gaps.some(
            (g) => t.t >= g.start && (g.end === null || t.t <= g.end),
          ),
      )
      .map((t) => ({ ...t, speaker: s.expert, stage: "live" as const })),
    ...(d?.transcript ?? [])
      .filter((t) => t.source === "user")
      .map((t) => ({ ...t, speaker: s.expert, stage: "debrief" as const })),
  ];
}
export function assertQuote(
  ref: { evidenceId: string; quote: string },
  evidence: Evidence[],
) {
  const e = evidence.find((e) => e.id === ref.evidenceId);
  if (
    !e ||
    !normalize(ref.quote) ||
    !normalize(e.text).includes(normalize(ref.quote))
  )
    throw new Error(
      "Expert quote does not match the saved transcript. Use the expert's exact words.",
    );
  return e;
}
export function matchDebriefQuote(d: Debrief, quote: string) {
  const row = [...d.transcript]
    .reverse()
    .find(
      (t) =>
        t.source === "user" && normalize(t.text).includes(normalize(quote)),
    );
  if (!normalize(quote) || !row)
    throw new Error(
      "Quote not found in debrief transcript; retry using the exact expert words.",
    );
  return row;
}
export function assertAnswers(d: Debrief) {
  if (
    d.answers.length < 3 ||
    d.draft.openQuestions.some(
      (q) => !d.answers.some((a) => a.questionId === q.id),
    )
  )
    throw new Error(
      "Answer every open question (at least three) before teach-back.",
    );
}
export function assertDraft(d: Draft, s: Session) {
  const ids = new Set<string>();
  for (const item of [...d.steps, ...d.guardrails, ...d.openQuestions]) {
    if (ids.has(item.id)) throw new Error("Draft contains duplicate IDs");
    ids.add(item.id);
    if (!s.events.some((e) => e.id === item.momentId))
      throw new Error("Draft refers to an unknown screen moment");
    if ("reason" in item && item.reason)
      assertQuote(item.reason, evidenceFor(s));
  }
  if (d.openQuestions.length < 3 || d.openQuestions.length > 5)
    throw new Error("Draft needs three to five questions");
}
export function hydrateMap(input: FinalInput, s: Session, d: Debrief): WorkMap {
  assertAnswers(d);
  if (d.phase !== "confirmed" || !d.confirmed)
    throw new Error("Explicit expert teach-back confirmation is required");
  assertQuote(d.confirmed, evidenceFor(s, d));
  const evidence = evidenceFor(s, d);
  const moments = new Map(s.events.map((e) => [e.id, e]));
  const ids = new Set<string>();
  for (const item of [...input.steps, ...input.guardrails]) {
    if (ids.has(item.id)) throw new Error("Work Map has duplicate IDs");
    ids.add(item.id);
  }
  const moment = (id: string) => {
    const e = moments.get(id);
    if (
      !e ||
      !e.frame ||
      s.gaps.some((g) => e.t >= g.start && (g.end === null || e.t <= g.end))
    )
      throw new Error("Work Map screen moment is missing or private");
    return { id: e.id, t: e.t, frame: e.frame, caption: e.summary };
  };
  const reason = (ref: { evidenceId: string; quote: string }) => {
    const e = assertQuote(ref, evidence);
    return {
      quote: ref.quote,
      speaker: s.expert,
      t: e.t,
      source: e.stage,
      evidenceId: e.id,
    };
  };
  const guardrails = input.guardrails.map((g) => ({
    id: g.id,
    kind: g.kind,
    rule: g.rule,
    screenMoment: moment(g.momentId),
    quote: g.reason.quote,
    reason: reason(g.reason),
    owner: g.owner ?? null,
    releaseCondition: g.releaseCondition ?? null,
  }));
  const steps = input.steps.map((step) => {
    if (step.guardrailIds.some((id) => !guardrails.some((g) => g.id === id)))
      throw new Error("Step refers to an unknown guardrail");
    return {
      id: step.id,
      screenMoment: moment(step.momentId),
      decision: step.decision,
      isJudgmentCall: step.isJudgmentCall,
      reason: reason(step.reason),
      guardrailIds: step.guardrailIds,
      owner: step.owner ?? null,
      releaseCondition: step.releaseCondition ?? null,
    };
  });
  const frames =
    s.frames ??
    Array.from(
      new Map(
        s.events.map((e) => [e.frame, { t: e.t, frame: e.frame }]),
      ).values(),
    );
  return {
    id: s.id,
    sessionId: s.id,
    title: input.title,
    expert: s.expert,
    createdAt: new Date().toISOString(),
    steps,
    guardrails,
    limitations: input.limitations,
    stats: {
      steps: steps.length,
      judgmentCalls: steps.filter((s) => s.isJudgmentCall).length,
      guardrails: guardrails.length,
    },
    teachback: {
      ...d.confirmed,
      speaker: s.expert,
      corrections: d.corrections,
    },
    replayFrames: frames
      .filter(
        (f) =>
          !s.gaps.some(
            (g) => f.t >= g.start && (g.end === null || f.t <= g.end),
          ),
      )
      .sort((a, b) => a.t - b.t),
    publication: { status: "pending", procedureIds: [], errors: [] },
  };
}
