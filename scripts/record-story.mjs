// Records the scripted story as a shareable 16:9 MP4 (1920x1080, 30 fps).
// Frames come from Chrome's screencast; the soundtrack is rebuilt from the
// same pre-rendered clips at the moments the page played them.
// Usage: npm run dev, then: npm run story:record [-- --url=http://127.0.0.1:3000]
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const url = (process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://127.0.0.1:3000") + "/story?record=1";
const out = path.resolve("recordings/sensei-demo-1080p.mp4");
const W = 1920, H = 1080, FPS = 30, LEAD = 0.4, TAIL = 1.5;
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const work = await mkdtemp(path.join(tmpdir(), "sensei-rec-"));
const browser = await chromium.launch({
  executablePath: chrome,
  args: ["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "--mute-audio"],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle" });
// Hide the Next.js dev badge if recording against `npm run dev`.
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);

const cdp = await page.context().newCDPSession(page);
const frames = [];
let n = 0;
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = path.join(work, `f${String(n++).padStart(5, "0")}.jpg`);
  frames.push({ file, t: metadata.timestamp });
  await writeFile(file, Buffer.from(data, "base64"));
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Demo/ }).click();
await page.waitForFunction(() => window.__story?.some((e) => e.type === "end"), null, { timeout: 180000 });
const events = await page.evaluate(() => window.__story);
// End on the slogan card (it leaves ~0.25 s before "end"), then hold it.
const cutoff = events.find((e) => e.type === "end").t / 1000 - 0.35;
const endAt = cutoff;
// Static screens send no frames; nudge a repaint until frames pass the end.
for (let i = 0; i < 100 && (frames.at(-1)?.t ?? 0) < cutoff + 0.2; i++) {
  await page.evaluate(() => (document.body.style.outline = document.body.style.outline ? "" : "0 solid transparent"));
  await page.waitForTimeout(100);
}
await cdp.send("Page.stopScreencast");
console.log(`last frame ${(frames.at(-1).t - endAt).toFixed(2)} s past the end`);
await browser.close();

const start = events.find((e) => e.type === "start").t / 1000 - LEAD;
const end = cutoff + TAIL;
const duration = end - start;

// Video: hold each screencast frame until the next one (variable timing -> 30 fps CFR).
const kept = frames.filter((f) => f.t <= cutoff);
const firstIdx = Math.max(0, kept.findLastIndex((f) => f.t <= start));
const seq = kept.slice(firstIdx);
let list = "";
for (let i = 0; i < seq.length; i++) {
  const from = Math.max(seq[i].t, start);
  const to = i + 1 < seq.length ? seq[i + 1].t : end; // last frame holds to the end
  if (to <= from) continue;
  list += `file '${seq[i].file}'\nduration ${(to - from).toFixed(4)}\n`;
}
list += `file '${seq.at(-1).file}'\n`;
await writeFile(path.join(work, "frames.txt"), list);

// Audio: each clip delayed to the moment it started, at its playback rate.
const clips = events.filter((e) => e.type === "clip");
const inputs = clips.flatMap((c) => ["-i", path.resolve(`public/story/${c.id}.mp3`)]);
const chains = clips.map((c, i) => {
  const delay = Math.max(0, Math.round((c.t / 1000 - start) * 1000));
  const tempo = c.rate && c.rate !== 1 ? `atempo=${c.rate},` : "";
  return `[${i + 1}:a]${tempo}aresample=48000,adelay=${delay}|${delay}[a${i}]`;
});
const mix = `${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,apad,atrim=0:${duration.toFixed(3)}[aout]`;

execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "concat", "-safe", "0", "-i", path.join(work, "frames.txt"),
  ...inputs,
  "-filter_complex", [...chains, mix, `[0:v]fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p[vout]`].join(";"),
  "-map", "[vout]", "-map", "[aout]",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-r", String(FPS),
  "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
  "-t", duration.toFixed(3), out,
], { stdio: "inherit" });
await rm(work, { recursive: true, force: true });
console.log(`Saved ${out} · ${duration.toFixed(1)} s · ${seq.length} frames · ${clips.length} voice clips`);
