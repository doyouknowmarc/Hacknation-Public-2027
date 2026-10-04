import { z } from "zod";
import { mutateSession, readSession } from "@/lib/store";
import { readWorkMap } from "@/lib/workmap-store";
import { recordOutcome, canRelease } from "@/lib/teach";
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("outcome"),
    refId: z.string(),
    result: z.enum(["correct", "corrected", "missed"]),
    note: z.string().min(1).max(2000),
    checkId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("commit"),
    checkId: z.string().uuid(),
    revision: z.string().min(1).max(100),
  }),
]);
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const s = await readSession((await params).id);
    if (!s.teaching) throw new Error("Not a practice session");
    return Response.json(s);
  } catch {
    return Response.json(
      { error: "Practice session not found" },
      { status: 404 },
    );
  }
}
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const b = schema.parse(await req.json());
    const value = await mutateSession((await params).id, async (s) => {
      const t = s.teaching;
      if (!t || s.status !== "active")
        throw new Error("Practice is not active");
      const map = await readWorkMap(t.mapId);
      if (!map) throw new Error("Work Map missing");
      if (b.action === "outcome") {
        return { ok: true, outcome: recordOutcome(t, map, b) };
      }
      const check = t.checks.at(-1);
      if (!check || check.id !== b.checkId || !canRelease(check, b.revision))
        throw new Error(
          "Wait for a safe review of the current decision before saving",
        );
      check.approved = true;
      return { allowed: true };
    });
    return Response.json(value);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Practice update failed" },
      { status: 400 },
    );
  }
}
