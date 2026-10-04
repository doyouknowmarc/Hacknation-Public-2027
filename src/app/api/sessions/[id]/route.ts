import { mutateSession, readSession } from "@/lib/store";
import { z } from "zod";
const schema = z.object({
  action: z.enum(["pause", "resume", "end", "transcript", "question"]),
  t: z.number().nonnegative(),
  text: z.string().max(10000).optional(),
  source: z.enum(["user", "ai"]).optional(),
  guardrail: z.boolean().optional(),
});
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(await readSession((await params).id));
  } catch {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
}
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const b = schema.parse(await req.json());
    const s = await mutateSession((await params).id, (s) => {
      s.elapsed = Math.max(s.elapsed, b.t);
      if (
        b.action === "transcript" &&
        s.status === "active" &&
        b.text &&
        b.source
      )
        s.transcript.push({
          id: crypto.randomUUID(),
          t: b.t,
          text: b.text,
          source: b.source,
        });
      if (b.action === "question" && s.status === "active") {
        s.questions++;
        s.guardrailAsked ||= !!b.guardrail;
      }
      if (b.action === "pause" && s.status === "active") {
        s.status = "paused";
        s.gaps.push({ start: b.t, end: null });
      }
      if (b.action === "resume" && s.status === "paused") {
        s.status = "active";
        const gap = s.gaps.at(-1);
        if (gap) gap.end = b.t;
      }
      if (b.action === "end") {
        s.status = "ended";
        s.endedAt = new Date().toISOString();
        const gap = s.gaps.at(-1);
        if (gap && gap.end === null) gap.end = b.t;
      }
      return s;
    });
    return Response.json(s);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid request" },
      { status: 400 },
    );
  }
}
