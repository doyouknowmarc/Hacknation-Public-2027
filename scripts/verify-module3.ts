import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = "http://127.0.0.1:3000";
const mapId = process.argv[2] || "4843cf9a-8a57-4b71-b480-cdfa2251a823";
async function json(url: string, body: unknown, method = "POST") {
  const r = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const b = await r.json();
  assert.equal(r.status, 200, b.error);
  return b;
}
async function main() {
  const s = await json("/api/teach", {
    mapId,
    learner: "Module 3 API verification",
  });
  console.log("Practice verification session:", s.id);
  const form = new FormData();
  form.append("sessionId", s.id);
  form.append("t", "1");
  form.append("analyze", "true");
  form.append("revision", "wrong-decision");
  form.append("action", "post");
  form.append(
    "image",
    new Blob([await readFile("docs/teach-posting-gate.jpg")], {
      type: "image/jpeg",
    }),
    "screen.jpg",
  );
  const r = await fetch(base + "/api/frame", { method: "POST", body: form });
  const b = await r.json();
  assert.equal(r.status, 200, b.error);
  assert.ok(!b.visionError, b.visionError);
  console.log(
    JSON.stringify(
      { sessionId: s.id, check: b.check, screen: b.screen },
      null,
      2,
    ),
  );
  assert.notEqual(b.check.risk.level, "none");
  if (mapId === "da1d7d84-141a-4961-aa3c-dc32eb7357aa")
    assert.equal(b.check.risk.level, "stop");
  const blocked = await fetch(base + `/api/teach/${s.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "commit",
      revision: "wrong-decision",
      checkId: b.check.id,
    }),
  });
  assert.equal(blocked.status, 400);
  console.log(
    "Real screenshot: unseen €7,200 posting blocked using captured rules, and server commit rejected.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
