import { z } from "zod";
import { readSession, mutateSession } from "@/lib/store";
import { readDebrief, writeFile, singleFlight } from "@/lib/workmap-store";
import { draftSchema, type Debrief } from "@/lib/workmap-types";
import { synthesize } from "@/lib/anthropic";
import { draftPrompt } from "@/lib/prompts/workmap";
import { assertDraft, evidenceFor } from "@/lib/evidence";
export const maxDuration = 240;
export async function POST(req: Request) {
  try {
    const { sessionId } = z
      .object({ sessionId: z.string().uuid() })
      .parse(await req.json());
    const result = await singleFlight(`draft:${sessionId}`, async () => {
      const existing = await readDebrief(sessionId);
      if (existing) return existing;
      const s = await readSession(sessionId);
      if (s.status !== "ended")
        throw new Error("End the capture before preparing a debrief");
      if (!s.events.length)
        throw new Error(
          "This capture has no analyzed screen moments. Capture ERP clicks with vision enabled first.",
        );
      const draft = await synthesize(draftSchema, draftPrompt, {
        expert: s.expert,
        events: s.events,
        transcript: s.transcript,
        evidence: evidenceFor(s),
      });
      assertDraft(draft, s);
      const d: Debrief = {
        sessionId,
        draft,
        createdAt: new Date().toISOString(),
        transcript: [],
        answers: [],
        corrections: [],
        phase: "questions",
        teachbackStartedAt: null,
        confirmed: null,
      };
      return mutateSession(sessionId, async () => {
        const saved = await readDebrief(sessionId);
        if (saved) return saved;
        await writeFile(sessionId, "debrief", d);
        return d;
      });
    });
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Draft failed" },
      { status: 400 },
    );
  }
}
