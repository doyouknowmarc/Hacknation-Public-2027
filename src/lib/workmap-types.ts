import { z } from "zod";
import type { Transcript } from "./types";
export const quoteRef = z.object({ evidenceId: z.string(), quote: z.string() });
export const draftSchema = z.object({
  title: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      momentId: z.string(),
      decision: z.string(),
      isJudgmentCall: z.boolean(),
      reason: quoteRef.nullable(),
    }),
  ),
  guardrails: z.array(
    z.object({
      id: z.string(),
      momentId: z.string(),
      kind: z.enum(["limit", "exception", "stop_and_ask", "never"]),
      rule: z.string(),
      reason: quoteRef.nullable(),
    }),
  ),
  openQuestions: z
    .array(
      z.object({
        id: z.string(),
        momentId: z.string(),
        question: z.string(),
        whyNeeded: z.string(),
      }),
    )
    .min(3)
    .max(5),
  teachbackOutline: z.array(z.string()),
});
export type Draft = z.infer<typeof draftSchema>;
export type Evidence = Transcript & {
  speaker: string;
  stage: "live" | "debrief";
};
export type Answer = {
  questionId: string;
  summary: string;
  evidenceId: string;
  quote: string;
};
export type Correction = {
  whatISaid: string;
  correction: string;
  evidenceId: string;
  quote: string;
};
export type Debrief = {
  sessionId: string;
  draft: Draft;
  createdAt: string;
  transcript: Transcript[];
  answers: Answer[];
  corrections: Correction[];
  phase: "questions" | "teachback" | "confirmed";
  teachbackStartedAt: number | null;
  confirmed: { quote: string; evidenceId: string; t: number } | null;
};
export const finalSchema = z.object({
  title: z.string(),
  steps: z
    .array(
      z.object({
        id: z.string(),
        momentId: z.string(),
        decision: z.string(),
        isJudgmentCall: z.boolean(),
        reason: quoteRef,
        guardrailIds: z.array(z.string()),
        owner: z.string().nullable(),
        releaseCondition: z.string().nullable(),
      }),
    )
    .min(1),
  guardrails: z.array(
    z.object({
      id: z.string(),
      momentId: z.string(),
      kind: z.enum(["limit", "exception", "stop_and_ask", "never"]),
      rule: z.string(),
      reason: quoteRef,
      owner: z.string().nullable(),
      releaseCondition: z.string().nullable(),
    }),
  ),
  limitations: z.array(z.string()),
});
export type FinalInput = z.infer<typeof finalSchema>;
export type ScreenMoment = {
  id: string;
  t: number;
  frame: string;
  caption: string;
};
export type Reason = {
  quote: string;
  speaker: string;
  t: number;
  source: "live" | "debrief";
  evidenceId: string;
};
export type Publication = {
  status: "pending" | "published" | "partial";
  agentId?: string;
  documentId?: string;
  procedureIds: string[];
  errors: string[];
};
export type WorkMap = {
  id: string;
  sessionId: string;
  title: string;
  expert: string;
  createdAt: string;
  steps: {
    id: string;
    screenMoment: ScreenMoment;
    decision: string;
    isJudgmentCall: boolean;
    reason: Reason;
    guardrailIds: string[];
    owner?: string | null;
    releaseCondition?: string | null;
  }[];
  guardrails: {
    id: string;
    kind: "limit" | "exception" | "stop_and_ask" | "never";
    rule: string;
    screenMoment: ScreenMoment;
    quote: string;
    reason: Reason;
    owner?: string | null;
    releaseCondition?: string | null;
  }[];
  limitations: string[];
  stats: { steps: number; judgmentCalls: number; guardrails: number };
  teachback: NonNullable<Debrief["confirmed"]> & {
    speaker: string;
    corrections: Correction[];
  };
  replayFrames: { t: number; frame: string }[];
  publication: Publication;
};
