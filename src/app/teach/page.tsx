import Link from "next/link";
import { redirect } from "next/navigation";
import { listSessions } from "@/lib/store";
import { readWorkMap } from "@/lib/workmap-store";
export const dynamic = "force-dynamic";
// Shortcut into teacher mode: opens the tutor for the newest confirmed Work Map.
export default async function TeachShortcut() {
  for (const s of await listSessions()) {
    if (s.teaching) continue;
    if (await readWorkMap(s.id).catch(() => null)) redirect(`/teach/${s.id}`);
  }
  return (
    <main className="capture">
      <div className="eyebrow">MODULE 03 / TEACH</div>
      <h1>No confirmed Work Map yet.</h1>
      <p className="lead">
        Teacher mode replays an expert’s confirmed reasoning. Capture a
        workflow, finish the debrief, then come back here.
      </p>
      <div className="actions">
        <Link className="button primary" href="/capture">
          Start a capture →
        </Link>
        <Link className="button" href="/studio">
          Demo flow
        </Link>
      </div>
    </main>
  );
}
