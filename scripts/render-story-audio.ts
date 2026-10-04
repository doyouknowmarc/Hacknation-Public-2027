// Pre-renders every spoken line of the scripted story with ElevenLabs.
// Re-running only renders lines whose text, voice or model changed.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { SPEAKERS, STORY_MODEL, storyLines } from "../src/lib/story";
const out = "public/story";
async function main() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is missing");
  await mkdir(out, { recursive: true });
  const manifestFile = `${out}/manifest.json`;
  const manifest: Record<string, string> = JSON.parse(
    await readFile(manifestFile, "utf8").catch(() => "{}"),
  );
  const force = process.argv.includes("--force");
  for (const step of storyLines()) {
    const { voiceId: voice, stability } = SPEAKERS[step.speaker];
    const hash = createHash("sha1")
      .update(`${STORY_MODEL}|${voice}|${stability}|${step.text}`)
      .digest("hex");
    if (!force && manifest[step.id] === hash) continue;
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: step.text,
          model_id: STORY_MODEL,
          voice_settings: { stability, similarity_boost: 0.8 },
        }),
      },
    );
    if (!r.ok)
      throw new Error(`${step.id}: ElevenLabs ${r.status} ${(await r.text()).slice(0, 300)}`);
    await writeFile(`${out}/${step.id}.mp3`, Buffer.from(await r.arrayBuffer()));
    manifest[step.id] = hash;
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
    console.log(`rendered ${step.id} (${SPEAKERS[step.speaker].name})`);
  }
  console.log("Story audio is up to date.");
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
