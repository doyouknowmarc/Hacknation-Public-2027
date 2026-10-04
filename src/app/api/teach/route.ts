import { z } from "zod";
import { createSession, mutateSession } from "@/lib/store";
import { readWorkMap } from "@/lib/workmap-store";
export async function POST(req: Request) {
  try {
    const b = z
      .object({
        mapId: z.string().uuid(),
        learner: z.string().trim().min(1).max(80),
      })
      .parse(await req.json());
    const map = await readWorkMap(b.mapId);
    if (!map) throw new Error("Confirmed Work Map not found");
    const s = await createSession(map.expert);
    await mutateSession(s.id, (s) => {
      s.teaching = {
        mapId: map.id,
        learner: b.learner,
        checks: [],
        outcomes: [],
        report: null,
      };
    });
    return Response.json({
      ...s,
      teaching: {
        mapId: map.id,
        learner: b.learner,
        checks: [],
        outcomes: [],
        report: null,
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not start practice" },
      { status: 400 },
    );
  }
}
