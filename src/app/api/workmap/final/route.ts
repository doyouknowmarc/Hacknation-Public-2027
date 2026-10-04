import { z } from "zod";
import { readSession, sessionKey } from "@/lib/store";
import { exists } from "@/lib/storage";
import {
  readDebrief,
  readWorkMap,
  writeFile,
  singleFlight,
} from "@/lib/workmap-store";
import { finalSchema } from "@/lib/workmap-types";
import { assertAnswers, evidenceFor, hydrateMap } from "@/lib/evidence";
import { synthesize } from "@/lib/anthropic";
import { finalPrompt } from "@/lib/prompts/workmap";
import { publishWorkMap } from "@/lib/publish-workmap";
export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    const b = z
      .object({
        sessionId: z.string().uuid(),
        retryPublication: z.boolean().optional(),
      })
      .parse(await req.json());
    const result = await singleFlight(`final:${b.sessionId}`, async () => {
      const existing = await readWorkMap(b.sessionId);
      if (existing)
        return b.retryPublication ? publishWorkMap(existing) : existing;
      const s = await readSession(b.sessionId);
      const d = await readDebrief(b.sessionId);
      if (!d || d.phase !== "confirmed")
        throw new Error(
          "Confirm the expert teach-back before creating a Work Map",
        );
      assertAnswers(d);
      const input = await synthesize(finalSchema, finalPrompt, {
        expert: s.expert,
        events: s.events,
        draft: d.draft,
        answers: d.answers,
        corrections: d.corrections,
        transcript: d.transcript,
        confirmed: d.confirmed,
        evidence: evidenceFor(s, d),
      });
      const map = hydrateMap(input, s, d);
      for (const item of [...map.steps, ...map.guardrails]) {
        const frame = item.screenMoment.frame;
        const expected = `/api/frames/${s.id}/`;
        if (
          !frame.startsWith(expected) ||
          !/^\d+$/.test(frame.slice(expected.length))
        )
          throw new Error("Invalid frame reference");
        if (!(await exists(sessionKey(s.id, `frames/${frame.slice(expected.length)}.jpg`))))
          throw new Error("Linked screen moment is missing");
      }
      await writeFile(s.id, "workmap", map);
      return publishWorkMap(map);
    });
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Work Map failed" },
      { status: 400 },
    );
  }
}
