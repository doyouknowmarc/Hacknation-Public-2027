import sharp from "sharp";
import { mutateSession, readSession, sessionKey } from "@/lib/store";
import { writeBytes } from "@/lib/storage";
import { readWorkMap } from "@/lib/workmap-store";
import { validateRisk, observeCompletion } from "@/lib/teach";
import { riskSchema, type TeachCheck } from "@/lib/teach-types";
import { analyzeFrame } from "@/lib/vision";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const id = String(form.get("sessionId"));
    const t = Number(form.get("t"));
    const image = form.get("image");
    if (
      !(image instanceof File) ||
      image.size > 5000000 ||
      !Number.isFinite(t) ||
      t < 0
    )
      return Response.json({ error: "Invalid frame" }, { status: 400 });
    const jpeg = await sharp(Buffer.from(await image.arrayBuffer()), {
      limitInputPixels: 16000000,
    })
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    const frame = await mutateSession(id, async (s) => {
      if (s.status !== "active") return null;
      const n = s.frameCount++;
      const name = `${n}.jpg`;
      await writeBytes(sessionKey(id, `frames/${name}`), jpeg);
      s.elapsed = Math.max(s.elapsed, t);
      const url = `/api/frames/${id}/${n}`;
      (s.frames ??= []).push({ t, frame: url });
      return url;
    });
    if (!frame) return Response.json({ ignored: true });
    if (form.get("analyze") !== "true")
      return Response.json({ frame, events: [] });
    const before = await readSession(id);
    const revision = String(form.get("revision") || "").slice(0, 100);
    const action = ["approve", "hold", "approval"].includes(
      String(form.get("action")),
    )
      ? String(form.get("action"))
      : null;
    const map = before.teaching
      ? await readWorkMap(before.teaching.mapId)
      : null;
    if (before.teaching && !map) throw new Error("Confirmed Work Map missing");
    const expectedInvoice = String(form.get("expectedInvoice") || "").slice(
      0,
      100,
    );
    let check: TeachCheck | undefined;
    let analysis;
    try {
      analysis = await analyzeFrame(
        jpeg,
        before.screen,
        map || undefined,
        action,
      );
      if (
        map &&
        expectedInvoice &&
        analysis.screen_state.invoice?.replace(/[^0-9]/g, "") !==
          expectedInvoice.replace(/[^0-9]/g, "")
      )
        throw new Error(
          "The shared tab does not show the selected invoice. Share the paired ERP tab and review again.",
        );
    } catch (e) {
      return Response.json({
        frame,
        events: [],
        visionError: e instanceof Error ? e.message : "Vision failed",
      });
    }
    const events = await mutateSession(id, (s) => {
      if (
        s.status !== "active" ||
        s.gaps.some((g) => t >= g.start && (g.end === null || t <= g.end))
      )
        return [];
      s.screen = analysis.screen_state;
      if (s.teaching && map) {
        const risk = validateRisk(
          riskSchema.parse("risk" in analysis ? analysis.risk : null),
          map,
        );
        check = {
          id: crypto.randomUUID(),
          t,
          frame,
          revision,
          action,
          invoice: analysis.screen_state.invoice,
          status: analysis.screen_state.status,
          modal: analysis.screen_state.modal,
          risk,
        };
        s.teaching.checks.push(check);
        observeCompletion(s.teaching, map, check);
      }
      const moments = analysis.events.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        t,
        frame,
      }));
      s.events.push(...moments);
      return moments;
    });
    return Response.json({
      frame,
      events,
      screen: analysis.screen_state,
      check,
      revision,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Frame upload failed" },
      { status: 400 },
    );
  }
}
