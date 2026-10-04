export async function eleven(path: string, init: RequestInit = {}) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is missing");
  const r = await fetch(`https://api.elevenlabs.io/v1${path}`, {
    ...init,
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!r.ok)
    throw new Error(
      `ElevenLabs request failed (${r.status}): ${(await r.text()).slice(0, 500)}`,
    );
  return r.json();
}
