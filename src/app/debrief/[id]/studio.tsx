"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  useConversation,
  useConversationClientTool,
  useRawConversation,
} from "@elevenlabs/react";
import { stamp, type Session } from "@/lib/types";
import VoicePicker, { useVoiceSettings } from "@/components/VoicePicker";
import { sessionVoice } from "@/lib/voice";
import type { Debrief } from "@/lib/workmap-types";
export default function Studio({
  session,
  initial,
  mapReady,
}: {
  session: Session;
  initial: Debrief | null;
  mapReady: boolean;
}) {
  const [d, setD] = useState(initial);
  const current = useRef(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(session.events[0]?.id || "");
  const [text, setText] = useState<Record<string, string>>({});
  const [correction, setCorrection] = useState("");
  const [muted, setMuted] = useState(false);
  const run = useRef({
    collecting: false,
    stopping: false,
    start: Date.now() - (initial?.transcript.at(-1)?.t ?? 0) * 1000,
  });
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const raw = useRawConversation();
  const update = (value: Debrief) => {
    current.current = value;
    setD(value);
  };
  async function request(action: string, extra: Record<string, unknown> = {}) {
    const r = await fetch(`/api/debrief/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    update(b);
    return b as Debrief;
  }
  const clock = () =>
    Math.max(
      (current.current?.transcript.at(-1)?.t ?? 0) + 0.01,
      (Date.now() - run.current.start) / 1000,
    );
  const voiceSettings = useVoiceSettings();
  const conversation = useConversation({
    onMessage: (m) => {
      if (!run.current.collecting) return;
      const row = {
        id: crypto.randomUUID(),
        t: clock(),
        source: m.source,
        text: m.message,
      };
      pending.current = pending.current
        .then(() => request("transcript", row))
        .catch((e) => setError(e.message));
    },
    onDisconnect: () => {
      run.current.collecting = false;
      setMuted(false);
      if (!run.current.stopping)
        setMessage(
          current.current?.phase === "confirmed"
            ? "Teach-back confirmed. Create your Work Map below."
            : "Voice call ended. Your progress is saved; reconnect or continue in writing.",
        );
    },
    onError: (m) => setError(String(m)),
  });
  async function tool(action: string, params: Record<string, unknown> = {}) {
    try {
      await pending.current;
      const value = await request(action, params);
      return JSON.stringify({
        ok: true,
        phase: value.phase,
        answered: value.answers.map((a) => a.questionId),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Tool failed";
      setError(message);
      return JSON.stringify({ ok: false, error: message });
    }
  }
  useConversationClientTool(
    "show_moment",
    ({ id }: Record<string, unknown>) => {
      const moment = session.events.find((e) => e.id === id);
      if (!moment)
        return JSON.stringify({ ok: false, error: "Unknown moment ID" });
      setSelected(String(id));
      return JSON.stringify({
        ok: true,
        caption: moment.summary,
        t: stamp(moment.t),
      });
    },
  );
  useConversationClientTool("record_answer", (p: Record<string, unknown>) =>
    tool("record_answer", p),
  );
  useConversationClientTool("start_teachback", () => tool("start_teachback"));
  useConversationClientTool("record_correction", (p: Record<string, unknown>) =>
    tool("record_correction", p),
  );
  useConversationClientTool("confirm_teachback", (p: Record<string, unknown>) =>
    tool("confirm_teachback", p),
  );
  useEffect(
    () => () => {
      run.current.collecting = false;
    },
    [],
  );
  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }
  async function prepare() {
    await act("Preparing follow-ups…", async () => {
      const r = await fetch("/api/workmap/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      update(b);
    });
  }
  async function connect() {
    await act("Connecting voice…", async () => {
      run.current.stopping = false;
      run.current.start =
        Date.now() - (current.current?.transcript.at(-1)?.t ?? 0) * 1000;
      const r = await fetch("/api/el-token?role=debrief");
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      run.current.collecting = true;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          conversation.endSession();
          run.current.collecting = false;
          reject(new Error("Voice connection timed out"));
        }, 30000);
        conversation.startSession({
          conversationToken: b.token,
          connectionType: "webrtc",
          ...sessionVoice(voiceSettings.ref.current),
          dynamicVariables: {
            ...sessionVoice(voiceSettings.ref.current).dynamicVariables,
            expert_name: session.expert,
            work_map_draft: JSON.stringify(current.current?.draft),
            open_questions: JSON.stringify({
              questions: current.current?.draft.openQuestions,
              answers: current.current?.answers,
              corrections: current.current?.corrections,
              phase: current.current?.phase,
            }),
          },
          onConnect: () => {
            clearTimeout(timeout);
            resolve();
          },
          onError: (m) => {
            clearTimeout(timeout);
            run.current.collecting = false;
            reject(new Error(String(m)));
          },
        });
      });
      setMessage("");
    });
  }
  async function stop() {
    run.current.stopping = true;
    if (raw) await raw.endSession();
    else conversation.endSession();
    await pending.current;
    run.current.collecting = false;
    setMuted(false);
  }
  async function saveAnswer(id: string) {
    await act("Saving answer…", async () => {
      const quote = text[id]?.trim();
      if (!quote) return;
      await request("transcript", {
        id: crypto.randomUUID(),
        t: clock(),
        source: "user",
        text: quote,
      });
      await request("record_answer", {
        question_id: id,
        answer_summary: quote,
        expert_quote: quote,
      });
      setText((t) => ({ ...t, [id]: "" }));
    });
  }
  async function saveCorrection() {
    await act("Saving correction…", async () => {
      const quote = correction.trim();
      await request("transcript", {
        id: crypto.randomUUID(),
        t: clock(),
        source: "user",
        text: quote,
      });
      await request("record_correction", {
        what_i_said: "The current teach-back interpretation",
        correction: quote,
        expert_quote: quote,
      });
      setCorrection("");
    });
  }
  async function confirm() {
    await act("Confirming teach-back…", async () => {
      const quote = "Yes, this matches how I work, including the corrections.";
      await request("transcript", {
        id: crypto.randomUUID(),
        t: clock(),
        source: "user",
        text: quote,
      });
      await request("confirm_teachback", { expert_quote: quote });
    });
  }
  async function finalize() {
    await act("Building your Work Map…", async () => {
      await stop();
      const r = await fetch("/api/workmap/final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      window.location.href = `/map/${session.id}`;
    });
  }
  const connected = conversation.status === "connected";
  const complete =
    d &&
    d.draft.openQuestions.every((q) =>
      d.answers.some((a) => a.questionId === q.id),
    );
  const moment = session.events.find((e) => e.id === selected);
  const disabled = connected || mapReady || d?.phase === "confirmed";
  return (
    <main className="capture">
      <div className="page-title">
        <div>
          <div className="eyebrow">MODULE 02 / DEBRIEF</div>
          <h1>The decisions behind the work.</h1>
          <p>
            {session.expert} · {stamp(session.elapsed)} captured ·{" "}
            {session.events.length} observed moments
          </p>
        </div>
        <span className="status">
          <span />
          {d?.phase === "confirmed"
            ? "Expert confirmed"
            : connected
              ? conversation.isSpeaking
                ? "Speaking"
                : muted
                  ? "Microphone muted"
                  : "Listening"
              : "Capture saved"}
        </span>
      </div>
      {mapReady && (
        <div className="note">
          <b>Your Work Map is saved.</b>
          <div className="actions">
            <Link className="button primary" href={`/map/${session.id}`}>
              Open Work Map →
            </Link>
          </div>
        </div>
      )}
      {!d ? (
        <section className="panel">
          <h2>Let’s fill in what the screen couldn’t tell us.</h2>
          <p>
            Prepare three to five follow-ups about reasoning, exceptions and
            limits. Then review the apprentice’s understanding before confirming
            it.
          </p>
          <button
            className="primary"
            disabled={
              !!busy || !session.events.length || session.status !== "ended"
            }
            onClick={prepare}
          >
            {busy || "Prepare debrief →"}
          </button>
          {!session.events.length && (
            <p className="muted">
              No analyzed screen moments were saved. Capture some ERP clicks
              first.
            </p>
          )}
          {session.status !== "ended" && (
            <p className="muted">End the active capture before debriefing.</p>
          )}
        </section>
      ) : (
        <div className="capture-grid">
          <section className="panel">
            <div className="page-title">
              <h2>
                Open questions{" "}
                <span className="badge">
                  {d.answers.length} / {d.draft.openQuestions.length}
                </span>
              </h2>
            </div>
            {!mapReady && d.phase !== "confirmed" && (
              <>
                <div className="actions">
                  {connected ? (
                    <>
                      <button
                        onClick={() => {
                          try {
                            conversation.setMuted(!muted);
                            setMuted(!muted);
                          } catch (e) {
                            setError(String(e));
                          }
                        }}
                      >
                        {muted ? "Unmute microphone" : "Mute microphone"}
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => act("Closing voice…", stop)}
                      >
                        Stop voice
                      </button>
                    </>
                  ) : (
                    <button
                      className="primary"
                      disabled={!!busy}
                      onClick={connect}
                    >
                      Start voice debrief
                    </button>
                  )}
                </div>
                <VoicePicker
                  settings={voiceSettings.settings}
                  update={voiceSettings.update}
                  connected={conversation.status === "connected"}
                />
                <p className="muted">
                  Speak with the apprentice, or answer in writing below.
                  Progress is saved after each answer.
                </p>
              </>
            )}
            {d.draft.openQuestions.map((q, index) => {
              const answer = d.answers.find((a) => a.questionId === q.id);
              return (
                <article className="question" key={q.id}>
                  <button
                    className="moment-link"
                    onClick={() => setSelected(q.momentId)}
                  >
                    Moment {index + 1} ↗
                  </button>
                  <h3>{q.question}</h3>
                  <p className="muted">{q.whyNeeded}</p>
                  {answer && (
                    <>
                      <span className="badge">✓ Answer saved</span>
                      <blockquote>“{answer.quote}”</blockquote>
                    </>
                  )}
                  {!disabled && (
                    <>
                      <label>
                        {answer ? "Update your answer" : "Your answer"}
                        <textarea
                          disabled={!!busy}
                          value={text[q.id] || ""}
                          onChange={(e) =>
                            setText((t) => ({ ...t, [q.id]: e.target.value }))
                          }
                        />
                      </label>
                      <button
                        disabled={!!busy || !text[q.id]?.trim()}
                        onClick={() => saveAnswer(q.id)}
                      >
                        Save answer
                      </button>
                    </>
                  )}
                </article>
              );
            })}
            {complete && d.phase === "questions" && !connected && !mapReady && (
              <button
                className="primary"
                disabled={!!busy}
                onClick={() =>
                  act("Opening teach-back…", () => request("start_teachback"))
                }
              >
                Review teach-back →
              </button>
            )}
            {d.phase !== "questions" && (
              <div className="teachback">
                <div className="eyebrow">
                  TEACH-BACK / REVIEW BEFORE CONFIRMING
                </div>
                <h2>Here’s what I understood</h2>
                {connected ? (
                  <p>
                    The apprentice will speak the updated interpretation and ask
                    you to confirm it. Check the conversation below.
                  </p>
                ) : (
                  <>
                    <p>
                      These are the observed decisions and the reasoning you
                      supplied:
                    </p>
                    {d.draft.steps
                      .filter((s) => s.reason !== null)
                      .map((s) => (
                        <p key={s.id}>{s.decision}</p>
                      ))}
                    {d.answers.map((a) => (
                      <blockquote key={a.questionId}>“{a.quote}”</blockquote>
                    ))}
                    {d.corrections.length > 0 && (
                      <>
                        <h3>Your corrections take precedence</h3>
                        {d.corrections.map((c, i) => (
                          <blockquote key={i}>“{c.quote}”</blockquote>
                        ))}
                      </>
                    )}
                    {d.phase === "teachback" && !connected && !mapReady && (
                      <>
                        <label>
                          Correct anything that doesn’t match
                          <textarea
                            value={correction}
                            onChange={(e) => setCorrection(e.target.value)}
                            placeholder="Explain the correction in your own words"
                          />
                        </label>
                        <button
                          disabled={!!busy || !correction.trim()}
                          onClick={saveCorrection}
                        >
                          Save correction
                        </button>
                        <div className="actions">
                          <button
                            className="primary"
                            disabled={!!busy || !!correction.trim()}
                            onClick={confirm}
                          >
                            Yes, this matches how I work
                          </button>
                        </div>
                        <small>
                          Confirm only after reviewing all answers and
                          corrections above.
                        </small>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            {d.phase === "confirmed" && !mapReady && (
              <div className="actions">
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={finalize}
                >
                  {busy || "Create confirmed Work Map →"}
                </button>
              </div>
            )}
          </section>
          <aside>
            <section className="panel">
              <h2>The expert’s screen moment</h2>
              {moment ? (
                <>
                  <img
                    className="evidence-image"
                    src={moment.frame}
                    alt={moment.summary}
                  />
                  <p>{moment.summary}</p>
                  <small>
                    Capture · {stamp(moment.t)} · Invoice{" "}
                    {moment.invoice || "—"}
                  </small>
                </>
              ) : (
                <p>Select a question to view its moment.</p>
              )}
            </section>
            <section className="panel conversation-log">
              <h2>Debrief conversation</h2>
              {d.transcript.length ? (
                d.transcript.map((t) => (
                  <div className="transcript" key={t.id}>
                    <small>
                      {t.source === "user" ? session.expert : "Apprentice"} ·
                      Debrief {stamp(t.t)}
                    </small>
                    <p>{t.text}</p>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Your voice or written answers will appear here.
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
      {busy && <p role="status">{busy}</p>}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
      <details className="panel">
        <summary>Original capture transcript & private gaps</summary>
        {session.transcript.map((t) => (
          <div key={t.id} className="transcript">
            <small>
              {t.source === "user" ? session.expert : "Apprentice"} · Capture{" "}
              {stamp(t.t)}
            </small>
            <p>{t.text}</p>
          </div>
        ))}
        {session.gaps.map((g, i) => (
          <p key={i}>
            Off the record: {stamp(g.start)}–
            {g.end === null ? "ongoing" : stamp(g.end)}
          </p>
        ))}
      </details>
    </main>
  );
}
