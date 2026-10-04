import Link from "next/link";
import { demoFlow } from "@/lib/demo";
import { stamp } from "@/lib/types";
import ResetDemo from "@/components/ResetDemo";
import { demoScript } from "@/lib/demo-script";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { capture, debrief, map, practice } = await demoFlow();
  const captured = capture?.status === "ended";
  const steps = [
    {
      kanji: "観",
      meaning: "observe",
      title: "01 / Capture",
      text: "Process the three expert invoices while the apprentice listens.",
      done: captured,
      status: !capture
        ? "Not started"
        : captured
          ? `${capture.expert} · ${stamp(capture.elapsed)} · ${capture.events.length} moments`
          : "In progress",
      href: "/capture",
      label: capture ? "New capture" : "Start capture",
    },
    {
      kanji: "問",
      meaning: "question",
      title: "02 / Debrief",
      text: "Answer the apprentice’s questions about your decisions.",
      done: debrief?.phase === "confirmed",
      status: !captured
        ? "Waiting for capture"
        : debrief?.phase === "confirmed"
          ? "Confirmed by the expert"
          : debrief
            ? "In progress"
            : "Ready",
      href: captured ? `/debrief/${capture!.id}` : null,
      label: "Open debrief",
    },
    {
      kanji: "型",
      meaning: "kata, the form",
      title: "03 / Work Map",
      text: "Every step, judgment call and guardrail linked to its evidence.",
      done: !!map,
      status: map
        ? `${map.stats.steps} steps · ${map.stats.guardrails} guardrails`
        : "Created after the debrief",
      href: map ? `/map/${map.id}` : null,
      label: "View Work Map",
    },
    {
      kanji: "教",
      meaning: "teach",
      title: "04 / Teach",
      text: "An apprentice applies the expert’s reasoning to fresh invoices.",
      done: !!practice?.teaching?.report,
      status: !map
        ? "Needs a Work Map"
        : practice
          ? `${practice.teaching!.learner} · ${practice.status === "ended" ? "finished" : "practicing"}`
          : "Ready",
      href: map ? `/teach/${map.id}` : null,
      label: "Open teacher mode",
    },
  ];
  const next = steps.find((s) => !s.done && s.href);
  return (
    <main className="home">
      <div className="dojo-hero">
        <div>
          <h1>
            Watch the work.
            <br />
            Learn the why.
          </h1>
          <p className="lead">
            Sensei watches an expert clear real invoices, asks why at the right
            moments, and teaches that judgment to the next person.
          </p>
        </div>
        <div className="calligraphy" aria-hidden>
          <p className="calligraphy-kanji">先生</p>
          <span className="hanko">道場</span>
        </div>
      </div>
      <div className="actions">
        {next && (
          <Link className="button primary" href={next.href!}>
            {next.label} →
          </Link>
        )}
        <ResetDemo />
      </div>
      <div className="steps demo-flow">
        {steps.map((s) => (
          <article
            key={s.title}
            className={s.done ? "done" : s === next ? "next" : ""}
          >
            <span className="stage-kanji" title={s.meaning}>
              {s.kanji}
            </span>
            <b>{s.title}</b>
            <p>{s.text}</p>
            <small>
              {s.done ? "✓ " : ""}
              {s.status}
            </small>
            {s.href ? (
              <Link className="button" href={s.href}>
                {s.label}
              </Link>
            ) : (
              <button disabled>{s.label}</button>
            )}
          </article>
        ))}
      </div>
      <details className="demo-script">
        <summary>
          <b>Demo script</b> · {demoScript.title}
        </summary>
        {demoScript.steps.map((step) => (
          <section key={step.title}>
            <h3>{step.title}</h3>
            <p className="muted">{step.intro}</p>
            {step.lines.map((l) => (
              <div className="script-line" key={l.q}>
                <small>{l.cue}</small>
                <p>
                  <b>Agent:</b> “{l.q}”
                </p>
                <p>
                  <b>Answer:</b> {l.a}
                </p>
              </div>
            ))}
          </section>
        ))}
      </details>
    </main>
  );
}
