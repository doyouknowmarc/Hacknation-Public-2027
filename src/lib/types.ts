import { z } from "zod";
export const screenSchema = z.object({
  invoice: z.string().nullable(),
  supplier: z.string().nullable(),
  amount: z.string().nullable(),
  project: z.string().nullable(),
  approver: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string().nullable(),
  modal: z.string().nullable(),
  unsaved: z.boolean(),
});
export const visionSchema = z.object({
  screen_state: screenSchema,
  activity: z.string(),
  events: z.array(
    z.object({
      type: z.string(),
      summary: z.string(),
      invoice: z.string().nullable(),
      field: z.string().nullable(),
      from: z.string().nullable(),
      to: z.string().nullable(),
      decision_worthy: z.boolean(),
      unanswered_why: z.string().nullable(),
    }),
  ),
});
export type ScreenState = z.infer<typeof screenSchema>;
export type Moment = z.infer<typeof visionSchema>["events"][number] & {
  id: string;
  t: number;
  frame: string;
};
export type Transcript = {
  id: string;
  t: number;
  source: "user" | "ai";
  text: string;
};
export type Session = {
  id: string;
  teaching?: import("./teach-types").Teaching;
  expert: string;
  startedAt: string;
  endedAt: string | null;
  status: "active" | "paused" | "ended";
  events: Moment[];
  transcript: Transcript[];
  gaps: { start: number; end: number | null }[];
  questions: number;
  guardrailAsked: boolean;
  screen: ScreenState | null;
  frameCount: number;
  frames?: { t: number; frame: string }[];
  elapsed: number;
};
export const stamp = (s: number) =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
