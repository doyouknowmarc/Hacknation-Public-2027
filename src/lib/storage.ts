import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
// Where sessions, debriefs, Work Maps and click frames live. Locally: files
// under data/. On Vercel every route can run on a different instance, so the
// files go to Upstash Redis instead (connected from the Vercel Marketplace,
// which provides KV_REST_API_URL / KV_REST_API_TOKEN).
// Keys look like "<session-id>/session.json" or "<session-id>/frames/3.jpg".

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const usesRedis = !!(redisUrl && redisToken);
export const dataRoot = path.join(process.cwd(), "data");
const PREFIX = "sensei:";
const SESSIONS = `${PREFIX}sessions`;

async function redis<T = unknown>(...command: (string | number)[]): Promise<T> {
  const r = await fetch(redisUrl!, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const b = (await r.json()) as { result?: T; error?: string };
  if (!r.ok || b.error) throw new Error(`Storage error: ${b.error || r.status}`);
  return b.result as T;
}
function onVercelWithoutStorage() {
  if (process.env.VERCEL && !usesRedis)
    throw new Error(
      "Sessions need shared storage on Vercel. Connect Upstash Redis to this project (see README), then redeploy.",
    );
}

export async function readText(key: string): Promise<string | null> {
  if (usesRedis) return redis<string | null>("GET", PREFIX + key);
  try {
    return await fs.readFile(path.join(dataRoot, key), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function writeText(key: string, value: string) {
  onVercelWithoutStorage();
  if (usesRedis) {
    await redis("SET", PREFIX + key, value);
    return;
  }
  const file = path.join(dataRoot, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  // Write then rename, so readers never see half a file.
  await fs.writeFile(file + ".tmp", value);
  await fs.rename(file + ".tmp", file);
}
export async function readBytes(key: string): Promise<Buffer | null> {
  if (usesRedis) {
    const b64 = await redis<string | null>("GET", PREFIX + key);
    return b64 === null ? null : Buffer.from(b64, "base64");
  }
  try {
    return await fs.readFile(path.join(dataRoot, key));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function writeBytes(key: string, value: Buffer) {
  onVercelWithoutStorage();
  if (usesRedis) {
    await redis("SET", PREFIX + key, value.toString("base64"));
    return;
  }
  const file = path.join(dataRoot, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value);
}
export async function exists(key: string) {
  if (usesRedis) return (await redis<number>("EXISTS", PREFIX + key)) === 1;
  return fs
    .access(path.join(dataRoot, key))
    .then(() => true)
    .catch(() => false);
}

// Session index.
export async function addSession(id: string) {
  if (usesRedis) await redis("SADD", SESSIONS, id);
}
export async function sessionIds(): Promise<string[]> {
  if (usesRedis) return redis<string[]>("SMEMBERS", SESSIONS);
  try {
    return (await fs.readdir(dataRoot)).filter((n) => /^[a-f0-9-]{36}$/.test(n));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}
// Demo reset: moves sessions out of the index. Nothing is deleted.
export async function archiveSessions(stamp: string) {
  const ids = await sessionIds();
  if (!ids.length) return { archived: 0, to: null };
  if (usesRedis) {
    await redis("SADD", `${PREFIX}archive:${stamp}`, ...ids);
    await redis("SREM", SESSIONS, ...ids);
    return { archived: ids.length, to: `archive:${stamp}` };
  }
  const to = path.join(process.cwd(), "data-archive", stamp);
  await fs.mkdir(to, { recursive: true });
  for (const id of ids) await fs.rename(path.join(dataRoot, id), path.join(to, id));
  return { archived: ids.length, to };
}

// Cross-instance lock for read-modify-write of one session (Redis only;
// locally the in-process queue in store.ts is enough).
export async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  if (!usesRedis) return fn();
  const key = `${PREFIX}lock:${id}`;
  const token = randomUUID();
  for (let i = 0; ; i++) {
    if ((await redis("SET", key, token, "NX", "PX", 15000)) === "OK") break;
    if (i > 150) throw new Error("Session is busy. Please try again.");
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
  }
  try {
    return await fn();
  } finally {
    // Release only our own lock.
    await redis(
      "EVAL",
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      token,
    ).catch(() => {});
  }
}
