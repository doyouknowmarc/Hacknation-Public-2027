"use client";
import { useState } from "react";
import Link from "next/link";
import {
  GROUPS,
  STATUS_HINT,
  STATUS_LABEL,
  cases,
  dimensions,
  rules,
  valueChain,
  type Dimension,
} from "@/lib/knowledge";

type Tab = "dimensions" | "examples" | "rules";
type Level = "chain" | "finance" | "invoice";

function DimCard({ d, active, onPick }: { d: Dimension; active: boolean; onPick: () => void }) {
  return (
    <button className={`dim-card ${active ? "active" : ""}`} onClick={onPick} aria-pressed={active}>
      <span className="dim-letter">{d.id}</span>
      <span>
        <b>{d.name}</b>
        <small>{d.short}</small>
      </span>
    </button>
  );
}

export default function KnowledgeView() {
  const [tab, setTab] = useState<Tab>("dimensions");
  const [level, setLevel] = useState<Level>("invoice");
  const [dimId, setDimId] = useState<Dimension["id"]>("C");
  const [caseId, setCaseId] = useState(cases[0].id);
  const dim = dimensions.find((d) => d.id === dimId)!;
  const c = cases.find((x) => x.id === caseId)!;
  const byId = (id: string) => dimensions.find((d) => d.id === id)!;

  return (
    <main className="knowledge">
      <div className="eyebrow">THE KNOWLEDGE BEHIND A WORK MAP</div>
      <h1>Seven dimensions of an expert decision</h1>
      <p className="lead">
        An expert’s judgment is more than “approve” or “hold”. Sensei breaks every decision into
        seven dimensions, asks the expert about each one, and keeps track of what has been
        confirmed and what is still unknown.
      </p>

      <section className="zoom">
        <div className="zoom-steps" role="tablist" aria-label="Where this knowledge sits">
          {(
            [
              ["chain", "Value chain"],
              ["finance", "Accounting & Finance"],
              ["invoice", "Invoice processing"],
            ] as [Level, string][]
          ).map(([id, label], i) => (
            <button key={id} role="tab" aria-selected={level === id} className={level === id ? "on" : ""} onClick={() => setLevel(id)}>
              <small>Level {3 - i}</small>
              {label}
            </button>
          ))}
        </div>
        {level === "chain" && (
          <div className="zoom-body chain">
            <p className="muted">Accounting & Finance sits in firm infrastructure, a support activity of the value chain.</p>
            <div className="chain-support">
              {valueChain.support.map((s) => (
                <button key={s} className={s === "Firm infrastructure" ? "hit" : ""} onClick={() => s === "Firm infrastructure" && setLevel("finance")}>
                  {s === "Firm infrastructure" ? "Firm infrastructure · Accounting & Finance →" : s}
                </button>
              ))}
            </div>
            <div className="chain-primary">
              {valueChain.primary.map((p, i) => (
                <span key={p}>
                  <small>0{i + 1}</small>
                  {p}
                </span>
              ))}
              <span className="margin">Margin</span>
            </div>
          </div>
        )}
        {level === "finance" && (
          <div className="zoom-body finance">
            <p className="muted">Invoice processing is one of the finance sub-processes. It is the one mapped so far.</p>
            <div className="finance-grid">
              {valueChain.finance.map((f) => (
                <button key={f.name} className={f.mapped ? "hit" : ""} onClick={() => f.mapped && setLevel("invoice")} disabled={!f.mapped}>
                  <b>{f.name}</b>
                  <small>{f.mapped ? "Mapped · zoom in →" : "Not mapped yet"}</small>
                </button>
              ))}
            </div>
          </div>
        )}
        {level === "invoice" && (
          <div className="zoom-body invoice">
            {[
              ["01", "Capture", "Screen events + expert explanations"],
              ["02", "Map", "An expert-confirmed Work Map"],
              ["03", "Teach", "Independent decisions + practice needs"],
            ].map(([n, t, s]) => (
              <div key={n} className={`flow-step ${t === "Map" ? "on" : ""}`}>
                <small>{n}</small>
                <b>{t}</b>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="k-tabs" role="tablist">
        {(
          [
            ["dimensions", "Knowledge dimensions"],
            ["examples", "Examples"],
            ["rules", "Rules & practices"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "primary" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "dimensions" && (
        <>
          <section className="panel dim-map">
            <div className="dim-cols">
              {GROUPS.map((g, gi) => (
                <div key={g.title} className={`dim-col col-${gi}`}>
                  <div className="eyebrow">{g.title.toUpperCase()}</div>
                  {g.ids.map((id) => (
                    <DimCard key={id} d={byId(id)} active={dimId === id} onPick={() => setDimId(id)} />
                  ))}
                </div>
              ))}
            </div>
            <DimCard d={byId("G")} active={dimId === "G"} onPick={() => setDimId("G")} />
            <div className="dim-legend">
              <span>Evidence supports all six dimensions.</span>
              <span>Read left to right: understand the case → make the judgment explicit → define the response.</span>
            </div>
          </section>

          <section className="panel dim-detail" aria-live="polite">
            <div>
              <div className="eyebrow">DIMENSION {dim.id}</div>
              <h2>{dim.name}</h2>
              <small>Sensei asks the expert</small>
              <p className="dim-ask">“{dim.ask}”</p>
              <small>Information to capture</small>
              <p>{dim.capture}</p>
              {dim.note && <p className="dim-note">{dim.note}</p>}
            </div>
            <div>
              <div className="eyebrow">SEEN IN THE DEMO · INV 2042, PROJECT ATLAS</div>
              <table className="dim-table">
                <tbody>
                  {dim.example.map((f) => (
                    <tr key={f.label} className={f.status}>
                      <th>{f.label}</th>
                      <td>{f.value ?? "—"}</td>
                      <td>
                        <span className={`status-tag ${f.status}`} title={STATUS_HINT[f.status]}>
                          {STATUS_LABEL[f.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted dim-source">
                From the scripted demo: Sabine’s capture and debrief. “Not captured” marks what a real
                rollout would still have to ask.
              </p>
            </div>
          </section>
        </>
      )}

      {tab === "examples" && (
        <section className="examples">
          <p className="muted">Three situations, three different decisions. Select a case.</p>
          <div className="case-tabs">
            {cases.map((x) => (
              <button key={x.id} className={x.id === caseId ? "on" : ""} onClick={() => setCaseId(x.id)}>
                <b>{x.title}</b>
                <small>{x.tag}</small>
              </button>
            ))}
          </div>
          <article className="panel case">
            <div>
              <div className="eyebrow">THE SITUATION</div>
              <p className="case-situation">{c.situation}</p>
              <blockquote className="expert-quote">
                “{c.quote}”<footer>Sabine · demo capture</footer>
              </blockquote>
            </div>
            <dl className="case-decision">
              <div><dt>Condition (C)</dt><dd>{c.condition}</dd></div>
              <div><dt>Response (E)</dt><dd>{c.response}</dd></div>
              <div><dt>Reason (D)</dt><dd>{c.reason}</dd></div>
              <div><dt>Resume when (F)</dt><dd>{c.resume}</dd></div>
            </dl>
          </article>
        </section>
      )}

      {tab === "rules" && (
        <section className="rules">
          <p className="muted">
            Business rules decide the route. Practice guidance only advises and never adds an approval step.
          </p>
          <div className="panel rules-table-wrap">
            <table className="rules-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Scope / condition</th>
                  <th>Action</th>
                  <th>Owner</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className={r.kind === "Practice guidance" ? "guidance" : ""}>
                    <td>
                      <span className="rule-id">{r.id}</span>
                      <b>{r.name}</b>
                      <small>{r.kind}</small>
                    </td>
                    <td>{r.scope}</td>
                    <td>{r.action}</td>
                    <td>{r.owner}</td>
                    <td>
                      <span className={`status-tag ${r.kind === "Business rule" ? "confirmed" : "derived"}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            In the demo, all three business rules are confirmed by the expert. In a real rollout they’d
            also need a policy reference and an effective date to count as authorised.
          </p>
        </section>
      )}

      <div className="actions knowledge-cta">
        <Link className="button primary" href="/">
          ▶ Watch the demo
        </Link>
        <Link className="button" href="/studio">
          Open app
        </Link>
      </div>
    </main>
  );
}
