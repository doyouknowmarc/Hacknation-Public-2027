"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  useConversation,
  useConversationClientTool,
  useRawConversation,
} from "@elevenlabs/react";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import Replay from "@/components/Replay";
import HelpCorner, { type HelpReply } from "@/components/HelpCorner";
import type { Session } from "@/lib/types";
import type { WorkMap } from "@/lib/workmap-types";
import type { FrameAnalysis, TeachCheck, TeachReport } from "@/lib/teach-types";
import { mapReference } from "@/lib/teach";
import { COMPLETED } from "@/lib/invoices";
import VoicePicker, { useVoiceSettings } from "@/components/VoicePicker";
import { sessionVoice } from "@/lib/voice";
export default function Studio({ map }: { map: WorkMap }) {
  const [learner, setLearner] = useState("Lena"),
    [session, setSession] = useState<Session | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [paired, setPaired] = useState(false),
    [muted, setMuted] = useState(false),
    [check, setCheck] = useState<TeachCheck | null>(null),
    [replayId, setReplayId] = useState(""),
    [cue, setCue] = useState(
      "Open a practice session, then share the new-hire ERP tab.",
    ),
    [report, setReport] = useState<TeachReport | null>(null),
    [typed, setTyped] = useState(""),
    [helpReply, setHelpReply] = useState<HelpReply | null>(null);
  const raw = useRawConversation();
  const state = useRef({
    session: null as Session | null,
    active: false,
    stopping: false,
    start: Date.now(),
    sharing: false,
    lastClick: Date.now(),
    lastVoice: 0,
    lastActivity: 0,
    lastCue: 0,
    idleAsked: false,
    revision: "",
    action: null as string | null,
    invoice: "",
    checks: [] as TeachCheck[],
    seenRisk: new Set<string>(),
    predicted: new Set<string>(),
    explained: new Set<string>(),
    pendingPrediction: "",
  });
  const channel = useRef<BroadcastChannel | null>(null),
    clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    pending = useRef<Promise<unknown>>(Promise.resolve());
  const elapsed = () => Math.max(0, (Date.now() - state.current.start) / 1000);
  async function api(url: string, body?: unknown, method = "POST") {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    return b;
  }
  function saveTranscript(source: "user" | "ai", text: string) {
    const s = state.current;
    if (!s.session || !s.active) return;
    pending.current = pending.current
      .then(() =>
        api(
          `/api/sessions/${s.session!.id}`,
          { action: "transcript", source, text, t: elapsed() },
          "PATCH",
        ),
      )
      .catch((e) => setError(e.message));
  }
  const voiceSettings = useVoiceSettings();
  const voice = useConversation({
    onMessage: (m) => {
      if (m.source === "user") state.current.lastVoice = Date.now();
      saveTranscript(m.source, m.message);
    },
    onError: (m) => setError(String(m)),
    onDisconnect: () => {
      if (!state.current.stopping)
        setCue(
          "Voice ended. You can reconnect or continue in writing; screen checks remain active.",
        );
    },
  });
  function speak(text: string, immediate = false) {
    setCue(text);
    const s = state.current;
    if (voice.status === "connected") {
      voice.sendContextualUpdate(text);
      if (immediate || Date.now() - s.lastCue > 8000) {
        voice.sendUserMessage(`[TUTOR CUE] ${text}`);
        s.lastCue = Date.now();
      }
    }
  }
  // The learner rested the cursor in the help corner: give a grounded hint.
  function requestHelp(): HelpReply {
    const s = state.current;
    if (!s.active) return { ok: false, message: "Start practice first" };
    s.lastClick = Date.now();
    s.idleAsked = true;
    s.pendingPrediction = "";
    const latest = [...s.checks]
      .reverse()
      .find((c) => !s.invoice || c.invoice === s.invoice);
    const refId = latest?.risk.guardrail_id || latest?.risk.step_id || "";
    const ref = refId ? mapReference(map, refId) : null;
    if (ref) setReplayId(refId);
    const invoice = s.invoice || latest?.invoice || "";
    if (voice.status === "connected") {
      speak(
        `HELP: ${learner} is asking for help${invoice ? ` with invoice ${invoice}` : ""}. ${latest ? `Latest screen check: ${latest.risk.level} · ${latest.risk.explanation}` : "No screen check yet."} ${ref ? `Relevant expert evidence: “${ref.reason.quote}”` : "Use lookup_guardrails for the relevant rule."} Give one concrete hint grounded in ${map.expert}'s confirmed Work Map, then ask what they would check next. Do not simply hand over the answer.`,
        true,
      );
      return { ok: true, message: "Tutor is responding…" };
    }
    setCue(
      ref
        ? `Hint: ${map.expert} said “${ref.reason.quote}”. What would you check next?`
        : `Hint: ${map.expert}'s rules to keep in mind: ${
            map.guardrails
              .slice(0, 3)
              .map((g) => g.rule)
              .join(" · ") || "none captured yet"
          }.`,
    );
    return { ok: true, message: "Hint shown in the tutor tab" };
  }
  function analysis(b: FrameAnalysis) {
    const s = state.current;
    if (!s.active || b.revision !== s.revision) return;
    if (b.visionError || !b.check) {
      channel.current?.postMessage({
        type: "review",
        revision: s.revision,
        allowed: false,
        message:
          b.visionError || "No screen review available. Click Review again.",
      });
      return;
    }
    const c = b.check;
    s.checks.push(c);
    setCheck(c);
    if (voice.status === "connected")
      voice.sendContextualUpdate(
        JSON.stringify({ activeMapId: map.id, screen: b.screen, check: c }),
      );
    channel.current?.postMessage({
      type: "review",
      revision: c.revision,
      allowed: c.risk.level === "none" && !!c.action,
      checkId: c.id,
      message: c.risk.explanation || "Current decision reviewed.",
    });
    const earlier = [...s.checks]
      .reverse()
      .find(
        (x) =>
          x.id !== c.id &&
          x.invoice === c.invoice &&
          x.action &&
          x.risk.level === "none",
      );
    const refId =
      c.risk.guardrail_id ||
      c.risk.step_id ||
      (c.modal === null
        ? earlier?.risk.guardrail_id || earlier?.risk.step_id
        : null);
    const ref = refId ? mapReference(map, refId) : null;
    if (c.risk.level !== "none") {
      if (ref) setReplayId(refId!);
      const key = `${c.invoice}:${refId || "uncertain"}`;
      if (!s.seenRisk.has(key)) {
        s.seenRisk.add(key);
        speak(
          c.risk.level === "stop"
            ? `STOP before saving. Say this nearly verbatim, then wait for the learner's answer: "${c.risk.explanation}" ${ref ? `If they need more, quote ${map.expert}: “${ref.reason.quote}” and use show_expert_moment.` : "The map does not establish a safe decision here."}`
            : `This needs clarification before saving. ${c.risk.explanation} ${ref ? `Expert evidence: “${ref.reason.quote}”` : "The map does not establish a safe decision here."} Ask the learner what they would check.`,
          true,
        );
      }
      s.pendingPrediction = "";
    } else if (
      c.invoice &&
      !COMPLETED.test(c.status || "") &&
      !s.predicted.has(c.invoice)
    ) {
      s.pendingPrediction = c.invoice;
    } else if (
      c.status &&
      COMPLETED.test(c.status) &&
      c.modal === null &&
      ref &&
      !s.explained.has(c.invoice || "")
    ) {
      s.explained.add(c.invoice || "");
      speak(
        `EXPLAIN: The observed invoice is ${c.status}. Connect this decision to ${map.expert}'s exact words: “${ref.reason.quote}”. Do not claim mastery without a saved outcome.`,
      );
    }
  }
  const screen = useScreenCapture(
    () => {},
    setError,
    () => {
      setCue("Screen sharing stopped. Share the ERP again to resume checks.");
      channel.current?.postMessage({
        type: "unavailable",
        message: "Screen sharing stopped. Return to the tutor to share again.",
      });
    },
    analysis,
  );
  state.current.sharing = screen.sharing;
  useConversationClientTool(
    "show_expert_moment",
    ({ step_id }: Record<string, unknown>) => {
      const ref = mapReference(map, String(step_id));
      if (!ref)
        return JSON.stringify({
          ok: false,
          error: "Unknown active-map reference",
        });
      setReplayId(String(step_id));
      return JSON.stringify({
        ok: true,
        quote: ref.reason.quote,
        caption: ref.screenMoment.caption,
      });
    },
  );
  useConversationClientTool(
    "lookup_guardrails",
    ({ query }: Record<string, unknown>) => {
      const words = String(query || "")
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean);
      const matches = map.guardrails.filter(
        (g) =>
          !words.length ||
          words.some((w) =>
            (g.rule + g.reason.quote).toLowerCase().includes(w),
          ),
      );
      return JSON.stringify({
        mapId: map.id,
        guardrails: matches,
        limitations: map.limitations,
      });
    },
  );
  useConversationClientTool(
    "record_outcome",
    async (p: Record<string, unknown>) => {
      try {
        await pending.current;
        const s = state.current;
        const c = s.checks.at(-1);
        if (!s.session || !c) throw new Error("No screen check yet");
        return JSON.stringify(
          await api(
            `/api/teach/${s.session.id}`,
            {
              action: "outcome",
              refId: p.ref_id,
              result: p.result,
              note: p.note,
              checkId: c.id,
            },
            "PATCH",
          ),
        );
      } catch (e) {
        return JSON.stringify({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
  );
  useEffect(() => {
    if (!session || session.status === "ended") return;
    const c = new BroadcastChannel(`apprentice-erp-${session.id}`);
    channel.current = c;
    c.onmessage = (e) => {
      const s = state.current;
      if (e.data?.type === "ready") {
        setPaired(true);
        return;
      }
      if (e.data?.type === "help") {
        if (e.data.invoice) s.invoice = String(e.data.invoice);
        const reply = requestHelp();
        setHelpReply(reply);
        c.postMessage({ type: "help-ack", ...reply });
        return;
      }
      if (e.data?.type === "invalidate") {
        s.revision = e.data.revision;
        return;
      }
      if (e.data?.type !== "click" || !s.active) return;
      s.lastClick = Date.now();
      s.idleAsked = false;
      s.revision = e.data.revision;
      s.action = e.data.action || null;
      s.invoice = String(e.data.invoice || "");
      voice.sendUserActivity();
      if (clickTimer.current) clearTimeout(clickTimer.current);
      const meta = {
        revision: s.revision,
        action: s.action,
        invoice: s.invoice,
      };
      clickTimer.current = setTimeout(() => void screen.click(meta), 350);
    };
    c.postMessage({ type: "ping" });
    const timer = setInterval(() => {
      const s = state.current;
      if (!s.active || !s.sharing) return;
      if (!muted && voice.getInputVolume() > 0.08) s.lastVoice = Date.now();
      if (
        voice.status === "connected" &&
        Date.now() - s.lastActivity >= 10000
      ) {
        voice.sendUserActivity();
        s.lastActivity = Date.now();
      }
      const quiet =
        (muted || Date.now() - s.lastVoice > 1500) &&
        voice.getOutputVolume() < 0.03;
      if (s.pendingPrediction && quiet && Date.now() - s.lastClick > 2500) {
        const invoice = s.pendingPrediction;
        s.pendingPrediction = "";
        s.predicted.add(invoice);
        speak(
          `PREDICT: Invoice ${invoice} is open. Ask what ${map.expert} would do here (approve for payment, request approval, or hold) and why. Wait for the learner's answer.`,
        );
      }
      if (quiet && !s.idleAsked && Date.now() - s.lastClick >= 15000) {
        s.idleAsked = true;
        speak(
          "No clicks for 15 seconds. Ask once: Is something wrong, or would you like help?",
          true,
        );
      }
    }, 500);
    return () => {
      clearInterval(timer);
      if (clickTimer.current) clearTimeout(clickTimer.current);
      c.postMessage({
        type: "unavailable",
        message: "Tutor disconnected. Reopen the practice session.",
      });
      c.close();
      channel.current = null;
    };
  }, [session?.id, session?.status, muted, voice.status]);
  useEffect(
    () => () => {
      state.current.active = false;
      voice.endSession();
    },
    [],
  );
  async function act(label: string, fn: () => Promise<void>) {
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
  async function start() {
    await act("Starting practice…", async () => {
      const s: Session = await api("/api/teach", { mapId: map.id, learner });
      state.current.session = s;
      state.current.active = true;
      state.current.start = Date.now();
      state.current.lastClick = Date.now();
      setSession(s);
      setCue(
        "Open the new-hire ERP, share its tab here, then click the invoice you want to review.",
      );
      sessionStorage.setItem(`apprentice-teach-${map.id}`, s.id);
    });
  }
  useEffect(() => {
    const id = sessionStorage.getItem(`apprentice-teach-${map.id}`);
    if (!id) return;
    void api(`/api/teach/${id}`, undefined, "GET")
      .then((s: Session) => {
        state.current.session = s;
        state.current.active = s.status !== "ended";
        state.current.start = Date.now() - s.elapsed * 1000;
        state.current.checks = s.teaching!.checks;
        setSession(s);
        setReport(s.teaching!.report);
        setCheck(s.teaching!.checks.at(-1) || null);
        setLearner(s.teaching!.learner);
        setCue(
          s.status === "ended"
            ? "Practice saved. Generate or view your report below."
            : "Practice restored. Reopen and share the ERP tab, then click to resume.",
        );
      })
      .catch(() => {});
  }, [map.id]);
  async function connect() {
    await act("Connecting tutor…", async () => {
      const b = await api("/api/el-token?role=tutor", undefined, "GET");
      state.current.stopping = false;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          voice.endSession();
          reject(new Error("Voice connection timed out"));
        }, 30000);
        voice.startSession({
          conversationToken: b.token,
          connectionType: "webrtc",
          ...sessionVoice(voiceSettings.ref.current),
          dynamicVariables: {
            ...sessionVoice(voiceSettings.ref.current).dynamicVariables,
            expert_name: map.expert,
            learner_name: learner,
            work_map: JSON.stringify(map),
          },
          onConnect: () => {
            clearTimeout(timeout);
            resolve();
          },
          onError: (m) => {
            clearTimeout(timeout);
            reject(new Error(String(m)));
          },
        });
      });
      voice.sendContextualUpdate(
        `Restored practice history: ${JSON.stringify({ checks: state.current.checks.slice(-5), outcomes: state.current.session?.teaching?.outcomes })}`,
      );
    });
  }
  async function finish() {
    await act("Preparing practice report…", async () => {
      const s = state.current;
      if (!s.session) return;
      s.stopping = true;
      s.active = false;
      screen.stop();
      channel.current?.postMessage({
        type: "unavailable",
        message: "Practice finished.",
      });
      await raw?.endSession();
      await pending.current;
      const ended: Session = await api(
        `/api/sessions/${s.session.id}`,
        { action: "end", t: elapsed() },
        "PATCH",
      );
      s.session = ended;
      setSession(ended);
      const r: TeachReport = await api("/api/teach/report", {
        sessionId: s.session.id,
      });
      setReport(r);
    });
  }
  const ref = replayId ? mapReference(map, replayId) : null;
  return (
    <main className="capture">
      <HelpCorner
        reply={helpReply}
        label="Ask Sensei"
        onHelp={() => setHelpReply(requestHelp())}
      />
      <div className="eyebrow">MODULE 03 / PRACTICE WITH THE EXPERT</div>
      <h1>Learn {map.expert}’s judgment.</h1>
      <p className="lead">
        A fresh case. A tutor that watches your decisions and brings back the
        expert’s reasoning.
      </p>
      <div className="actions">
        <Link className="button" href={`/map/${map.id}`}>
          ← Work Map
        </Link>
        {session && (
          <a
            className="button"
            target="_blank"
            rel="noreferrer"
            href={`/erp?case=newhire&capture=${session.id}&teach=1`}
          >
            Open new-hire ERP ↗
          </a>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!session ? (
        <section className="panel">
          <label>
            Learner name
            <input
              value={learner}
              onChange={(e) => setLearner(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={!!busy || !learner.trim()}
            onClick={start}
          >
            {busy || "Start practice →"}
          </button>
        </section>
      ) : (
        <>
          <div className="map-chips">
            <span>{learner}</span>
            <span>
              {screen.sharing ? "● Screen shared" : "Screen not shared"}
            </span>
            <span>{paired ? "ERP paired" : "Waiting for ERP"}</span>
            <span>
              {voice.status === "connected"
                ? muted
                  ? "Microphone muted"
                  : "Voice connected"
                : "Voice optional"}
            </span>
            <span>{screen.frames} click captures this visit</span>
          </div>
          {session.status !== "ended" && (
            <div className="actions">
              <button
                disabled={!!busy}
                onClick={() =>
                  act("Sharing screen…", async () => {
                    await screen.share(session.id, elapsed);
                    setCue(
                      "Click in the ERP to start the tutor’s screen review. Screenshots are taken only after clicks.",
                    );
                  })
                }
              >
                {screen.sharing ? "Change shared tab" : "Share ERP tab"}
              </button>
              <button
                disabled={!!busy || voice.status === "connecting"}
                onClick={() =>
                  voice.status === "connected"
                    ? act("Stopping voice…", async () => {
                        state.current.stopping = true;
                        await raw?.endSession();
                      })
                    : connect()
                }
              >
                {voice.status === "connected"
                  ? "Disconnect voice"
                  : "Connect voice tutor"}
              </button>
              {voice.status === "connected" && (
                <button
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    voice.setMuted(next);
                    state.current.lastClick = Date.now();
                    state.current.idleAsked = false;
                  }}
                >
                  {muted ? "Unmute microphone" : "Mute microphone"}
                </button>
              )}
              <button
                disabled={!!busy}
                onClick={() => {
                  const s = state.current;
                  void screen.click({
                    revision: s.revision,
                    action: s.action,
                    invoice: s.invoice,
                  });
                }}
              >
                Review current screen
              </button>
              <button
                className="primary"
                disabled={!!busy || !state.current.checks.length}
                onClick={finish}
              >
                {busy || "Finish practice →"}
              </button>
            </div>
          )}
          {session.status !== "ended" && (
            <VoicePicker
              settings={voiceSettings.settings}
              update={voiceSettings.update}
              connected={voice.status === "connected"}
            />
          )}
          {session.status === "ended" && !report && (
            <button className="primary" disabled={!!busy} onClick={finish}>
              {busy || "Generate saved practice report"}
            </button>
          )}
          {check?.risk.level !== "none" && check && (
            <div className="tutor-stop" role="alert">
              <b>
                {check.risk.level === "stop"
                  ? `${map.expert} would stop here.`
                  : "Clarify before saving."}
              </b>
              <p>{check.risk.explanation}</p>
              <small>
                Decision checked before confirmation · invoice {check.invoice}
              </small>
            </div>
          )}
          <div className="map-grid">
            <section className="panel">
              <div className="eyebrow">TUTOR</div>
              <h2>Think it through.</h2>
              <p className="tutor-cue" aria-live="polite">
                {cue}
              </p>
              {session.status !== "ended" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!typed.trim()) return;
                    saveTranscript("user", typed);
                    state.current.lastVoice = Date.now();
                    if (voice.status === "connected")
                      voice.sendUserMessage(typed);
                    setCue(`Your answer: ${typed}`);
                    setTyped("");
                  }}
                >
                  <label>
                    Your reasoning
                    <textarea
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder="Explain your decision, or ask for help…"
                    />
                  </label>
                  <button disabled={!typed.trim()}>Save answer</button>
                </form>
              )}
              <p className="muted">
                Screenshots follow clicks. After 15 seconds without a click, the
                tutor checks in once. Muting keeps that timer running. Stuck?
                Rest your cursor in the top-right corner of the ERP (or this
                page) to ask the tutor for a hint.
              </p>
            </section>
            <section className="panel">
              <div className="eyebrow">EXPERT EVIDENCE</div>
              {ref ? (
                <>
                  <h2>{"rule" in ref ? ref.rule : ref.decision}</h2>
                  <Replay
                    key={replayId}
                    frames={map.replayFrames}
                    t={ref.screenMoment.t}
                    autoplay
                  />
                  <blockquote className="expert-quote">
                    “{ref.reason.quote}”
                    <footer>
                      {ref.reason.speaker} · {ref.reason.source}
                    </footer>
                  </blockquote>
                </>
              ) : (
                <p>
                  When a learned rule is at risk, the linked expert moment
                  appears here.
                </p>
              )}
              <div className="actions">
                {map.steps
                  .filter((s) => s.isJudgmentCall)
                  .map((s) => (
                    <button key={s.id} onClick={() => setReplayId(s.id)}>
                      Replay {s.id}
                    </button>
                  ))}
              </div>
            </section>
          </div>
        </>
      )}
      {report && (
        <section className="panel practice-report">
          <div className="eyebrow">
            {learner.toUpperCase()} / PRACTICE REPORT
          </div>
          <h2>{report.summary}</h2>
          <div className="map-grid">
            <div>
              <h3>Mastered</h3>
              {!report.mastered.length && (
                <p>No independent mastery established yet.</p>
              )}
              {report.mastered.map((i) => (
                <article key={i.refId}>
                  <b>{i.title}</b>
                  <p>{i.explanation}</p>
                  <blockquote>
                    “{i.quote}” — {i.speaker}
                  </blockquote>
                </article>
              ))}
            </div>
            <div>
              <h3>Needs practice</h3>
              {!report.needsPractice.length && (
                <p>
                  No specific mistake was established in the observed decisions.
                </p>
              )}
              {report.needsPractice.map((i) => (
                <article key={i.refId}>
                  <b>{i.title}</b>
                  <p>{i.explanation}</p>
                  <blockquote>
                    “{i.quote}” — {i.speaker}
                  </blockquote>
                  <button onClick={() => setReplayId(i.refId)}>
                    Replay expert moment
                  </button>
                </article>
              ))}
            </div>
          </div>
          <h3>Practice next</h3>
          <ul>
            {report.practiceNext.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          {report.limitations.map((l, i) => (
            <p className="muted" key={i}>
              {l}
            </p>
          ))}
          <button
            onClick={() => {
              sessionStorage.removeItem(`apprentice-teach-${map.id}`);
              setSession(null);
              setReport(null);
              state.current.predicted.clear();
              state.current.seenRisk.clear();
              state.current.explained.clear();
              state.current.checks = [];
              setCheck(null);
            }}
          >
            Start another practice
          </button>
        </section>
      )}
      {!!map.limitations.length && (
        <details className="panel">
          <summary>What this Work Map still needs clarified</summary>
          {map.limitations.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </details>
      )}
    </main>
  );
}
