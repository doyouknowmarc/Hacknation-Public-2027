"use client";
import { useState } from "react";
import Link from "next/link";
import type { WorkMap } from "@/lib/workmap-types";
import { stamp } from "@/lib/types";
import Replay from "@/components/Replay";
export default function WorkMapView({ initial }: { initial: WorkMap }) {
  const [map, setMap] = useState(initial);
  const [selected, setSelected] = useState(
    initial.steps[0]?.id || initial.guardrails[0]?.id,
  );
  const [replay, setReplay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const step = map.steps.find((s) => s.id === selected);
  const guardrail = map.guardrails.find((g) => g.id === selected);
  const item = step || guardrail;
  const markers = [
    ...map.steps.map((s) => ({
      id: s.id,
      t: s.screenMoment.t,
      label: s.decision,
      type: s.isJudgmentCall ? "Judgment" : "Step",
    })),
    ...map.guardrails.map((g) => ({
      id: g.id,
      t: g.screenMoment.t,
      label: g.rule,
      type: "Guardrail",
    })),
  ].sort((a, b) => a.t - b.t);
  async function retry() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/workmap/final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: map.id, retryPublication: true }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setMap(b);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="capture">
      <div className="eyebrow">MODULE 02 / CONFIRMED WORK MAP</div>
      <h1>{map.title}</h1>
      <div className="map-chips">
        <span>{map.stats.steps} steps</span>
        <span>{map.stats.judgmentCalls} judgment calls</span>
        <span>{map.stats.guardrails} guardrails</span>
        <span>✓ Confirmed by {map.expert}</span>
      </div>
      <div className="actions">
        <a className="button" href={`/api/workmap/${map.id}`} download>
          Export JSON ↓
        </a>
        <Link className="button" href={`/debrief/${map.id}`}>
          View debrief evidence
        </Link>
        <Link className="button primary" href={`/teach/${map.id}`}>
          Start tutor →
        </Link>
      </div>
      <div className="timeline" aria-label="Work Map timeline">
        {markers.map((m, i) => (
          <button
            key={m.id}
            aria-pressed={selected === m.id}
            className={selected === m.id ? "selected" : ""}
            onClick={() => {
              setSelected(m.id);
              setReplay(false);
            }}
          >
            <small>
              {stamp(m.t)} · {m.type}
            </small>
            <b>
              {i + 1}. {m.label}
            </b>
          </button>
        ))}
      </div>
      <div className="map-grid">
        <section className="panel">
          {item && (
            <>
              <div className="eyebrow">
                {guardrail
                  ? `GUARDRAIL / ${guardrail.kind.replaceAll("_", " ")}`
                  : step?.isJudgmentCall
                    ? "JUDGMENT CALL"
                    : "WORKFLOW STEP"}
              </div>
              <h2 className="map-decision">
                {step?.decision || guardrail?.rule}
              </h2>
              {(item.owner || item.releaseCondition) && (
                <div className="map-chips">
                  {item.owner && <span>Responsible: {item.owner}</span>}
                  {item.releaseCondition && (
                    <span>Release when: {item.releaseCondition}</span>
                  )}
                </div>
              )}
              {replay ? (
                <Replay
                  key={selected}
                  frames={map.replayFrames}
                  t={item.screenMoment.t}
                />
              ) : (
                <>
                  <img
                    className="evidence-image"
                    src={item.screenMoment.frame}
                    alt={item.screenMoment.caption}
                  />
                  <p className="muted">
                    {item.screenMoment.caption} · Capture{" "}
                    {stamp(item.screenMoment.t)}
                  </p>
                </>
              )}
              <button onClick={() => setReplay((v) => !v)}>
                {replay ? "Show linked moment" : "Replay expert’s clicks"}
              </button>
              <blockquote className="expert-quote">
                “{item.reason.quote}”
                <footer>
                  {item.reason.speaker} ·{" "}
                  {item.reason.source === "live" ? "Capture" : "Debrief"} at{" "}
                  {stamp(item.reason.t)}
                </footer>
              </blockquote>
              {step && step.guardrailIds.length > 0 && (
                <>
                  <h3>Guardrails for this step</h3>
                  {step.guardrailIds.map((id) => {
                    const g = map.guardrails.find((g) => g.id === id)!;
                    return (
                      <button
                        className="guardrail-link"
                        key={id}
                        onClick={() => {
                          setSelected(id);
                          setReplay(false);
                        }}
                      >
                        {g.rule} →
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </section>
        <aside>
          <section className="panel">
            <h2>Rules to carry forward</h2>
            {map.guardrails.length ? (
              map.guardrails.map((g) => (
                <button
                  key={g.id}
                  className="guardrail-link"
                  onClick={() => {
                    setSelected(g.id);
                    setReplay(false);
                  }}
                >
                  <small>{g.kind.replaceAll("_", " ")}</small>
                  <p>{g.rule}</p>
                </button>
              ))
            ) : (
              <p className="muted">
                No guardrails supported by expert quotes were captured.
              </p>
            )}
          </section>
          <section className="panel conversation-log">
            <h2>Expert confirmation</h2>
            <blockquote>“{map.teachback.quote}”</blockquote>
            <small>
              {map.expert} · Debrief {stamp(map.teachback.t)}
            </small>
            {map.teachback.corrections.length > 0 && (
              <p>
                {map.teachback.corrections.length} expert corrections
                incorporated.
              </p>
            )}
          </section>
          {map.limitations.length > 0 && (
            <section className="note">
              <b>What this map doesn’t yet cover</b>
              {map.limitations.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </section>
          )}
          <section className="note">
            <b>
              {map.publication.status === "published"
                ? "✓ Prepared for the tutor"
                : "Tutor preparation incomplete"}
            </b>
            <p>
              {map.publication.status === "published"
                ? `Knowledge document and ${map.publication.procedureIds.length} judgment procedures published. The teaching UI is next.`
                : "Your confirmed map is saved locally. Tutor setup can be retried without generating the map again."}
            </p>
            {map.publication.errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
            {map.publication.status !== "published" && (
              <button disabled={busy} onClick={retry}>
                {busy ? "Retrying…" : "Retry tutor preparation"}
              </button>
            )}
            {error && <p className="error">{error}</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
