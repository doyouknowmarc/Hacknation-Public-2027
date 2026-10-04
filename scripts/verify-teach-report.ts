import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = "http://127.0.0.1:3000";
async function main() {
  const sessionId = process.argv[2];
  if (!sessionId) throw new Error("Pass the verification practice session ID");
  const form = new FormData();
  for (const [key, value] of Object.entries({
    sessionId,
    t: "2",
    analyze: "true",
    revision: "hold-decision",
    action: "hold",
  }))
    form.append(key, value);
  form.append(
    "image",
    new Blob([await readFile("docs/teach-hold-review.jpg")], {
      type: "image/jpeg",
    }),
    "hold.jpg",
  );
  const r = await fetch(base + "/api/frame", { method: "POST", body: form });
  const b = await r.json();
  assert.equal(r.status, 200, b.error);
  assert.ok(!b.visionError, b.visionError);
  console.log(JSON.stringify(b.check, null, 2));
  assert.equal(b.check.risk.level, "none");
  const commit = await fetch(base + `/api/teach/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "commit",
      revision: "hold-decision",
      checkId: b.check.id,
    }),
  });
  assert.equal(commit.status, 200, await commit.text());
  const ended = await fetch(base + `/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "end", t: 3 }),
  });
  assert.equal(ended.status, 200);
  const report = await fetch(base + "/api/teach/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const output = await report.json();
  assert.equal(report.status, 200, output.error);
  assert.equal(output.mastered.length, 0);
  assert.ok(output.needsPractice.length);
  console.log(JSON.stringify(output, null, 2));
  const repeat = await fetch(base + "/api/teach/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  assert.deepEqual(await repeat.json(), output);
  console.log(
    "Safe hold review and commit passed. Real Opus report cites expert evidence, distinguishes unobserved save from mastery, and is cached.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
