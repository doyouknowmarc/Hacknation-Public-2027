import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Session } from "./types";
import { addSession, dataRoot, readText, sessionIds, withLock, writeText } from "./storage";
export { dataRoot };
// Storage key for a file inside a session ("<id>/<name>"); validates the ID.
export function sessionKey(id: string, name: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid session ID");
  return `${id}/${name}`;
}
// Local folder of a session (file storage only; tests and scripts clean up with it).
export function sessionDir(id: string) {
  return path.join(dataRoot, sessionKey(id, ""));
}
const queues = new Map<string, Promise<unknown>>();
export async function readSession(id: string): Promise<Session> {
  const text = await readText(sessionKey(id, "session.json"));
  if (text === null) {
    const e = new Error("Session not found") as NodeJS.ErrnoException;
    e.code = "ENOENT";
    throw e;
  }
  return JSON.parse(text);
}
export async function mutateSession<T>(
  id: string,
  fn: (s: Session) => Promise<T> | T,
): Promise<T> {
  const previous = queues.get(id) ?? Promise.resolve();
  const task = previous
    .catch(() => {})
    .then(() =>
      withLock(id, async () => {
        const s = await readSession(id);
        const result = await fn(s);
        await writeText(sessionKey(id, "session.json"), JSON.stringify(s, null, 2));
        await writeText(sessionKey(id, "events.json"), JSON.stringify(s.events, null, 2));
        return result;
      }),
    );
  queues.set(id, task);
  try {
    return await task;
  } finally {
    if (queues.get(id) === task) queues.delete(id);
  }
}
export async function createSession(expert: string) {
  const id = randomUUID();
  const s: Session = {
    id,
    expert,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: "active",
    events: [],
    transcript: [],
    gaps: [],
    questions: 0,
    guardrailAsked: false,
    screen: null,
    frameCount: 0,
    elapsed: 0,
  };
  await writeText(sessionKey(id, "session.json"), JSON.stringify(s, null, 2));
  await addSession(id);
  return s;
}
export async function listSessions() {
  const rows = await Promise.all(
    (await sessionIds()).map((n) => readSession(n).catch(() => null)),
  );
  return rows
    .filter((s): s is Session => !!s)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
