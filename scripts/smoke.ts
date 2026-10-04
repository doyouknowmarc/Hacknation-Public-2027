import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { sessionDir } from "../src/lib/store";
const base = "http://127.0.0.1:3000";
async function main() {
  let id = "";
  try {
    const create = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expert: "API smoke test" }),
    });
    assert.equal(create.status, 201);
    id = (await create.json()).id;
    const upload = async (analyze = false) => {
      const form = new FormData();
      form.append("sessionId", id);
      form.append("t", "4");
      form.append("analyze", String(analyze));
      form.append(
        "image",
        new Blob([await readFile("tests/fixtures/erp-inbox.png")], {
          type: "image/png",
        }),
        "screen.png",
      );
      const r = await fetch(`${base}/api/frame`, {
        method: "POST",
        body: form,
      });
      assert.equal(r.status, 200);
      return r.json();
    };
    const frame = await upload(process.argv.includes("--vision"));
    assert.ok(frame.frame);
    if (process.argv.includes("--vision")) {
      assert.ok(!frame.visionError, frame.visionError);
      assert.match(frame.screen.invoice, /2041/);
      assert.match(frame.screen.supplier, /Schäfer/);
      assert.match(frame.screen.status, /Ready for review/i);
      console.log(
        "Real ERP screenshot vision: invoice, supplier and status recognized.",
      );
    }
    assert.equal((await fetch(`${base}${frame.frame}`)).status, 200);
    const patch = async (action: string, t: number, extra = {}) => {
      const r = await fetch(`${base}/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, t, ...extra }),
      });
      assert.equal(r.status, 200);
      return r.json();
    };
    await patch("pause", 5);
    assert.equal((await upload()).ignored, true);
    await patch("transcript", 6, { source: "user", text: "Private words" });
    let session = await (await fetch(`${base}/api/sessions/${id}`)).json();
    assert.equal(session.transcript.length, 0);
    assert.equal(session.frameCount, 1);
    await patch("resume", 10);
    await patch("transcript", 11, {
      source: "user",
      text: "Public explanation",
    });
    session = await patch("end", 12);
    assert.equal(session.transcript.length, 1);
    assert.deepEqual(session.gaps, [{ start: 5, end: 10 }]);
    assert.equal((await upload()).ignored, true);
    const token = await fetch(`${base}/api/el-token`);
    assert.equal(token.status, 200);
    assert.ok((await token.json()).token);
    console.log(
      "Session persistence, frame replay, off-record exclusion, ended-session rejection and voice token passed.",
    );
  } finally {
    if (id) await rm(sessionDir(id), { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
