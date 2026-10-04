"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ACTION_STATUS,
  APPROVERS,
  STATUSES,
  cases,
  euro,
  type Invoice,
} from "@/lib/invoices";
import HelpCorner, { type HelpReply } from "@/components/HelpCorner";
export default function ERP() {
  const search = useSearchParams();
  const captureId = search.get("capture");
  const teaching = search.get("teach") === "1";
  const kind = search.get("case") === "newhire" ? "newhire" : "expert";
  const [rows, setRows] = useState<Invoice[]>(cases[kind]);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [modal, setModal] = useState<"approve" | "hold" | "approval" | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const connection = useRef<BroadcastChannel | null>(null);
  const revision = useRef("");
  const intent = useRef<string | null>(null);
  const invoiceRef = useRef(rows[selected].id);
  invoiceRef.current = rows[selected].id;
  const [review, setReview] = useState<{
    allowed: boolean;
    checkId?: string;
    message: string;
  }>({
    allowed: false,
    message: "Share this tab with the tutor, then review this decision.",
  });
  const [saving, setSaving] = useState(false);
  const [helpReply, setHelpReply] = useState<HelpReply | null>(null);
  const helpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function askForHelp() {
    setHelpReply(null);
    if (helpTimer.current) clearTimeout(helpTimer.current);
    connection.current?.postMessage({
      type: "help",
      invoice: invoiceRef.current,
      action: intent.current,
    });
    helpTimer.current = setTimeout(
      () =>
        setHelpReply({
          ok: false,
          message: `No answer from the ${teaching ? "tutor" : "capture"} tab`,
        }),
      2500,
    );
  }
  function invalidate() {
    revision.current = crypto.randomUUID();
    setReview({
      allowed: false,
      message: "Waiting for the tutor to review this decision…",
    });
    connection.current?.postMessage({
      type: "invalidate",
      revision: revision.current,
    });
  }
  function openModal(value: typeof modal) {
    intent.current = value;
    invalidate();
    setModal(value);
  }

  useEffect(() => {
    if (!captureId) return;
    const channel = new BroadcastChannel(`apprentice-erp-${captureId}`);
    connection.current = channel;
    if (!revision.current) revision.current = crypto.randomUUID();
    const click = () =>
      channel.postMessage({
        type: "click",
        revision: revision.current,
        action: intent.current,
        invoice: invoiceRef.current,
      });
    channel.onmessage = (e) => {
      if (e.data?.type === "ping") channel.postMessage({ type: "ready" });
      if (e.data?.type === "help-ack") {
        if (helpTimer.current) clearTimeout(helpTimer.current);
        setHelpReply({ ok: !!e.data.ok, message: String(e.data.message) });
      }
      if (teaching && e.data?.type === "unavailable")
        setReview({ allowed: false, message: e.data.message });
      if (
        teaching &&
        e.data?.type === "review" &&
        e.data.revision === revision.current
      )
        setReview({
          allowed: !!e.data.allowed,
          checkId: e.data.checkId,
          message: e.data.message,
        });
    };
    channel.postMessage({ type: "ready" });
    document.addEventListener("click", click);
    return () => {
      if (helpTimer.current) clearTimeout(helpTimer.current);
      document.removeEventListener("click", click);
      connection.current = null;
      channel.close();
    };
  }, [captureId, teaching]);
  useEffect(() => {
    const saved = localStorage.getItem(
      `apprentice-erp-v2-${kind}${captureId ? `-${captureId}` : ""}`,
    );
    if (saved) {
      try {
        setRows(JSON.parse(saved));
      } catch {
        setRows(cases[kind]);
      }
    } else setRows(cases[kind]);
    setSelected(0);
    setReady(true);
  }, [kind, teaching, captureId]);
  useEffect(() => {
    if (ready)
      localStorage.setItem(
        `apprentice-erp-v2-${kind}${captureId ? `-${captureId}` : ""}`,
        JSON.stringify(rows),
      );
  }, [rows, ready, kind, teaching, captureId]);
  const item = rows[selected];
  function update(p: Partial<Invoice>) {
    if (teaching) invalidate();
    setRows((r) => r.map((x, i) => (i === selected ? { ...x, ...p } : x)));
    setDirty(true);
  }
  function complete(status: Invoice["status"]) {
    update({ status });
    setDirty(false);
    openModal(null);
    if (teaching)
      connection.current?.postMessage({
        type: "click",
        revision: revision.current,
        action: null,
        invoice: invoiceRef.current,
      });
  }
  async function confirm() {
    if (!modal) return;
    if (teaching) {
      if (!captureId || !review.allowed || !review.checkId) return;
      const current = revision.current;
      setSaving(true);
      try {
        const r = await fetch(`/api/teach/${captureId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "commit",
            checkId: review.checkId,
            revision: current,
          }),
        });
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        if (current !== revision.current)
          throw new Error("The form changed. Review again before saving.");
        complete(ACTION_STATUS[modal]);
      } catch (e) {
        setReview({
          allowed: false,
          message: e instanceof Error ? e.message : "Review failed",
        });
      } finally {
        setSaving(false);
      }
    } else complete(ACTION_STATUS[modal]);
  }
  const finished = item.status !== STATUSES.ready;
  const needsRoute = modal === "approval" || modal === "hold";
  const canConfirm =
    !needsRoute || (!!item.approver && item.note.trim().length > 0);
  return (
    <main className="erp">
      {captureId && (
        <HelpCorner
          onHelp={askForHelp}
          reply={helpReply}
          label={teaching ? "Ask Sensei" : "Invite feedback"}
        />
      )}
      <div className="page-title">
        <div>
          <div className="eyebrow">NORDWERK SOFTWARE / ACCOUNTS PAYABLE</div>
          <h1>Expense inbox</h1>
          <p>
            Payment run <b>Friday, 11 Dec 2026</b> ·{" "}
            {kind === "expert" ? "Expert" : "New hire"} case
          </p>
        </div>
        <button
          onClick={() => {
            setRows(cases[kind]);
            setSelected(0);
            setDirty(false);
            openModal(null);
          }}
        >
          Reset case
        </button>
      </div>
      <div className="erp-grid">
        <aside className="panel invoice-list">
          <h2>
            Inbox <span className="badge">{rows.length}</span>
          </h2>
          {rows.map((x, i) => (
            <button
              className={`invoice-item ${selected === i ? "selected" : ""}`}
              key={x.id}
              onClick={() => {
                setSelected(i);
                setDirty(false);
                openModal(null);
              }}
            >
              <small>INV {x.id}</small>
              <b>{x.supplier}</b>
              <span>
                {euro(x.net)} net · {x.category}
              </span>
              <em className={`status-${x.status.split(" ")[0].toLowerCase()}`}>
                {x.status}
              </em>
            </button>
          ))}
        </aside>
        <section className="panel paper">
          <div className="paper-top">
            <span>SUPPLIER INVOICE</span>
            <b>#{item.id}</b>
          </div>
          <h2>{item.supplier}</h2>
          <p>
            Invoice date: {item.date} · {item.category}
          </p>
          <div className="line-item">
            <b>Description</b>
            <p>{item.description}</p>
            {item.project && (
              <p>
                Project <strong>{item.project}</strong>
              </p>
            )}
            {item.remark && <p className="invoice-remark">“{item.remark}”</p>}
          </div>
          <div className="amounts">
            <span>
              Net amount <b>{euro(item.net)}</b>
            </span>
            <span>
              VAT (19%) <b>{euro(item.net * 0.19)}</b>
            </span>
            <span className="total">
              Gross total <b>{euro(item.net * 1.19)}</b>
            </span>
          </div>
          <div className="po">
            <small>SUPPORTING DOCUMENTS</small>
            {item.docs.map((d) => (
              <p key={d.label} className={d.flag ? "doc-flag" : ""}>
                <strong>{d.label}:</strong> {d.value}
              </p>
            ))}
          </div>
          <div className="history">
            <h3>Supplier history</h3>
            {item.history.map((h) => (
              <p key={h}>{h}</p>
            ))}
          </div>
        </section>
        <section className="panel coding">
          <div className="page-title">
            <h2>Decision</h2>
          </div>
          <p>
            Status <b>{item.status}</b>
          </p>
          <label>
            Route to
            <select
              disabled={finished}
              value={item.approver}
              onChange={(e) => update({ approver: e.target.value })}
            >
              <option value="">No further approval</option>
              {APPROVERS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Note / justification
            <textarea
              disabled={finished}
              placeholder="Why this decision? What is needed for release?"
              value={item.note}
              onChange={(e) => update({ note: e.target.value })}
            />
          </label>
          <p className={dirty ? "unsaved" : "muted"}>
            {dirty
              ? "● Unsaved changes"
              : finished
                ? `✓ ${item.status}${item.approver ? ` · ${item.approver}` : ""}`
                : "No unsaved changes"}
          </p>
          <div className="stack">
            <button
              className="primary"
              disabled={finished}
              onClick={() => openModal("approve")}
            >
              Approve for payment
            </button>
            <button disabled={finished} onClick={() => openModal("approval")}>
              Request approval
            </button>
            <button disabled={finished} onClick={() => openModal("hold")}>
              Hold invoice
            </button>
          </div>
          <small>Training sandbox · no real payments</small>
        </section>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="panel modal"
          >
            <div className="eyebrow">INVOICE {item.id}</div>
            <h2 id="confirm-title">
              {modal === "approve"
                ? "Confirm approval for payment"
                : modal === "approval"
                  ? "Request approval"
                  : "Hold invoice"}
            </h2>
            <p className="confirmation-context">
              {item.supplier} · {item.description}
              {item.project && ` · ${item.project}`}
              <br />
              Net {euro(item.net)}
            </p>
            {modal === "approve" ? (
              <>
                <p>
                  Release {euro(item.net)} net for the next payment run without
                  further approval?
                </p>
                <p className="muted">Review your decision before saving.</p>
              </>
            ) : (
              <>
                <label>
                  {modal === "approval" ? "Approver" : "Route for clarification to"}
                  <select
                    value={item.approver}
                    onChange={(e) => update({ approver: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {APPROVERS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {modal === "approval"
                    ? "Business justification"
                    : "Reason for hold"}
                  <textarea
                    value={item.note}
                    onChange={(e) => update({ note: e.target.value })}
                  />
                </label>
                <p className="muted">
                  Payment stays pending until {item.approver || "the approver"}{" "}
                  responds.
                </p>
              </>
            )}
            {teaching && (
              <div className="erp-review" role="status">
                <b>
                  {review.allowed
                    ? "✓ Decision reviewed"
                    : "Tutor review required"}
                </b>
                <p>{review.message}</p>
                <button
                  disabled={saving}
                  onClick={() => {
                    connection.current?.postMessage({
                      type: "click",
                      revision: revision.current,
                      action: intent.current,
                      invoice: invoiceRef.current,
                    });
                  }}
                >
                  Review decision
                </button>
              </div>
            )}
            <div className="actions">
              <button disabled={saving} onClick={() => openModal(null)}>
                Back to invoice
              </button>
              <button
                className="primary"
                disabled={saving || !canConfirm || (teaching && !review.allowed)}
                onClick={confirm}
              >
                {saving
                  ? "Saving…"
                  : modal === "approve"
                    ? "Confirm & approve"
                    : modal === "approval"
                      ? "Send approval request"
                      : "Place on hold"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
