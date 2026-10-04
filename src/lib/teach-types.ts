import { z } from "zod";
import { visionSchema, type Transcript } from "./types";
export const riskSchema = z.object({
  level: z.enum(["none", "warn", "stop"]),
  guardrail_id: z.string().nullable(),
  step_id: z.string().nullable(),
  explanation: z.string(),
});
export const tutorVisionSchema = visionSchema.extend({ risk: riskSchema });
export type Risk = z.infer<typeof riskSchema>;
export type TeachCheck = {
  committed?: boolean;
  approved?: boolean;
  id: string;
  t: number;
  frame: string;
  revision: string;
  invoice: string | null;
  action: string | null;
  risk: Risk;
  status: string | null;
  modal: string | null;
};
export type Outcome = {
  id: string;
  refId: string;
  result: "correct" | "corrected" | "missed";
  note: string;
  checkId: string;
  t: number;
};
export type PracticeItem = {
  refId: string;
  title: string;
  explanation: string;
  quote: string;
  speaker: string;
  frame: string;
};
export type TeachReport = {
  createdAt: string;
  summary: string;
  mastered: PracticeItem[];
  needsPractice: PracticeItem[];
  practiceNext: string[];
  limitations: string[];
};
export type Teaching = {
  mapId: string;
  learner: string;
  checks: TeachCheck[];
  outcomes: Outcome[];
  report: TeachReport | null;
};
export type FrameAnalysis = {
  frame?: string;
  events: import("./types").Moment[];
  screen?: import("./types").ScreenState;
  check?: TeachCheck;
  visionError?: string;
  revision?: string;
};
export const reportSchema = z.object({
  summary: z.string(),
  mastered: z.array(z.object({ refId: z.string(), explanation: z.string() })),
  needsPractice: z.array(
    z.object({ refId: z.string(), explanation: z.string() }),
  ),
  practiceNext: z.array(z.string()).min(1).max(5),
  limitations: z.array(z.string()),
});
