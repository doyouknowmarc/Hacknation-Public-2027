import { z } from "zod";
import { readDebrief, mutateDebrief, readWorkMap } from "@/lib/workmap-store";
import { assertAnswers, matchDebriefQuote, normalize } from "@/lib/evidence";
const text = z.string().trim().min(1).max(12000);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("transcript"),
    id: z.string().uuid(),
    t: z.number().nonnegative(),
    source: z.enum(["user", "ai"]),
    text,
  }),
  z.object({
    action: z.literal("record_answer"),
    question_id: text,
    answer_summary: text,
    expert_quote: text,
  }),
  z.object({ action: z.literal("start_teachback") }),
  z.object({
    action: z.literal("record_correction"),
    what_i_said: text,
    correction: text,
    expert_quote: text,
  }),
  z.object({ action: z.literal("confirm_teachback"), expert_quote: text }),
]);
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const d = await readDebrief((await params).id);
    return d
      ? Response.json(d)
      : Response.json({ error: "Debrief not prepared" }, { status: 404 });
  } catch {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
}
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = (await params).id;
    const b = schema.parse(await req.json());
    const d = await mutateDebrief(id, async (d) => {
      if (await readWorkMap(id))
        throw new Error("This Work Map is finalized; debrief is read-only");
      if (b.action === "transcript") {
        if (!d.transcript.some((t) => t.id === b.id))
          d.transcript.push({
            id: b.id,
            t: b.t,
            source: b.source,
            text: b.text,
          });
        return d;
      }
      if (d.phase === "confirmed")
        throw new Error("Teach-back is already confirmed");
      if (b.action === "record_answer") {
        if (!d.draft.openQuestions.some((q) => q.id === b.question_id))
          throw new Error("Unknown question ID");
        const row = matchDebriefQuote(d, b.expert_quote);
        const answer = {
          questionId: b.question_id,
          summary: b.answer_summary,
          quote: b.expert_quote,
          evidenceId: row.id,
        };
        d.answers = d.answers.filter((a) => a.questionId !== b.question_id);
        d.answers.push(answer);
        d.phase = "questions";
        d.teachbackStartedAt = null;
        d.confirmed = null;
      }
      if (b.action === "start_teachback") {
        assertAnswers(d);
        d.phase = "teachback";
        d.teachbackStartedAt = d.transcript.at(-1)?.t ?? 0;
      }
      if (b.action === "record_correction") {
        if (d.phase !== "teachback") throw new Error("Begin teach-back first");
        const row = matchDebriefQuote(d, b.expert_quote);
        if (row.t < (d.teachbackStartedAt ?? 0))
          throw new Error("Correction must come after teach-back started");
        d.corrections.push({
          whatISaid: b.what_i_said,
          correction: b.correction,
          quote: b.expert_quote,
          evidenceId: row.id,
        });
        d.confirmed = null;
        d.teachbackStartedAt = row.t;
      }
      if (b.action === "confirm_teachback") {
        assertAnswers(d);
        if (d.phase !== "teachback") throw new Error("Begin teach-back first");
        const row = matchDebriefQuote(d, b.expert_quote);
        const latest = d.transcript.filter((t) => t.source === "user").at(-1);
        if (
          row.id !== latest?.id ||
          row.t <= (d.teachbackStartedAt ?? 0) ||
          !/(\byes\b|\bcorrect\b|\bexactly\b|\bconfirmed\b|\bthat's right\b|\bthat is right\b)/i.test(
            normalize(b.expert_quote),
          ) ||
          /(\bno\b|\bnot\b|\bbut\b|\bexcept\b|\bincorrect\b)/i.test(
            normalize(row.text),
          )
        )
          throw new Error(
            "Ask for a fresh, explicit yes after handling corrections",
          );
        d.phase = "confirmed";
        d.confirmed = { quote: b.expert_quote, evidenceId: row.id, t: row.t };
      }
      return d;
    });
    return Response.json(d);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid debrief action" },
      { status: 400 },
    );
  }
}
