import { sessionKey, mutateSession } from "./store";
import { readText, writeText } from "./storage";
import type { Debrief, WorkMap } from "./workmap-types";
export async function optionalFile<T>(
  id: string,
  name: "debrief" | "workmap",
): Promise<T | null> {
  const text = await readText(sessionKey(id, `${name}.json`));
  return text === null ? null : JSON.parse(text);
}
export async function writeFile<T>(
  id: string,
  name: "debrief" | "workmap",
  value: T,
) {
  await writeText(sessionKey(id, `${name}.json`), JSON.stringify(value, null, 2));
}
export async function mutateDebrief<T>(
  id: string,
  fn: (d: Debrief) => T | Promise<T>,
) {
  return mutateSession(id, async () => {
    const d = await optionalFile<Debrief>(id, "debrief");
    if (!d) throw new Error("Generate a draft first");
    const result = await fn(d);
    await writeFile(id, "debrief", d);
    return result;
  });
}
export const readDebrief = (id: string) => optionalFile<Debrief>(id, "debrief");
export const readWorkMap = (id: string) => optionalFile<WorkMap>(id, "workmap");
const operations = new Map<string, Promise<unknown>>();
export async function singleFlight<T>(
  key: string,
  run: () => Promise<T>,
): Promise<T> {
  const existing = operations.get(key);
  if (existing) return existing as Promise<T>;
  const job = run();
  operations.set(key, job);
  try {
    return await job;
  } finally {
    if (operations.get(key) === job) operations.delete(key);
  }
}
