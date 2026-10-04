import { listSessions } from "./store";
import { archiveSessions } from "./storage";
import { readDebrief, readWorkMap } from "./workmap-store";
// Moves every capture, debrief, Work Map and practice out of the demo (to
// data-archive/<stamp> locally, or an archive set in Redis). Nothing is deleted.
export async function resetDemo() {
  return archiveSessions(new Date().toISOString().replace(/:/g, "-"));
}
// The single demo flow: the most recent expert capture and what exists for it.
export async function demoFlow() {
  const sessions = await listSessions();
  const capture = sessions.find((s) => !s.teaching) ?? null;
  if (!capture) return { capture: null, debrief: null, map: null, practice: null };
  const [debrief, map] = await Promise.all([
    readDebrief(capture.id),
    readWorkMap(capture.id),
  ]);
  const practice =
    sessions.find((s) => s.teaching?.mapId === capture.id) ?? null;
  return { capture, debrief, map, practice };
}
