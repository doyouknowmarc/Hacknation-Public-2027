import { createSession, mutateSession, sessionDir } from "../src/lib/store";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
async function main() {
  const s = await createSession("Sabine · test fixture");
  const frame = `/api/frames/${s.id}/0`;
  await writeFile(
    path.join(sessionDir(s.id), "frames", "0.jpg"),
    await sharp(await readFile("tests/fixtures/erp-confirm.png"))
      .jpeg()
      .toBuffer(),
  );
  await mutateSession(s.id, (s) => {
    s.status = "ended";
    s.endedAt = new Date().toISOString();
    s.frameCount = 1;
    s.frames = [{ t: 12, frame }];
    s.elapsed = 20;
    s.events = [
      {
        id: randomUUID(),
        t: 12,
        frame,
        type: "approval_request",
        summary:
          "Invoice 2042: Anthropic Claude usage, €180 net, Project Atlas (allowance €100/month). Route to Project lead selected, request approval dialog open.",
        invoice: "2042",
        field: "approver",
        from: null,
        to: "Project lead",
        decision_worthy: true,
        unanswered_why:
          "What must be documented before this can be released?",
      },
    ];
    s.transcript = [
      {
        id: randomUUID(),
        t: 14,
        source: "user",
        text: "This is eighty euros over the Atlas allowance. The extra usage was for the urgent release, but urgent alone isn't enough: I need the project, why it was necessary, and the project lead's explicit approval before it's released.",
      },
    ];
  });
  await writeFile("/tmp/apprentice-module2-test-id", s.id);
  console.log("Synthetic Module 2 test session:", s.id);
  const r = await fetch("http://127.0.0.1:3000/api/workmap/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: s.id }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error);
  console.log(
    "Opus draft generated:",
    body.draft.openQuestions.map((q: { id: string; question: string }) => ({
      id: q.id,
      question: q.question,
    })),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
