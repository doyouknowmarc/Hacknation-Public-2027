"use client";
import { useEffect, useRef, useState } from "react";
import {
  useConversation,
  useConversationClientTool,
  useRawConversation,
} from "@elevenlabs/react";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import HelpCorner, { type HelpReply } from "@/components/HelpCorner";
import { cueFor } from "@/lib/conductor";
import VoicePicker, { useVoiceSettings } from "@/components/VoicePicker";
import { sessionVoice } from "@/lib/voice";
import { stamp, type Moment, type Session, type Transcript } from "@/lib/types";
export default function Capture() {
  const rawConversation = useRawConversation();
  const [session, setSession] = useState<Session | null>(null);
  const [expert, setExpert] = useState("Sabine");
  const [events, setEvents] = useState<Moment[]>([]);
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const [off, setOff] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [questions, setQuestions] = useState(0);
  const [guardrail, setGuardrail] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [paired, setPaired] = useState(false);
  const [helpReply, setHelpReply] = useState<HelpReply | null>(null);
  const [helps, setHelps] = useState(0);
  const state = useRef({
    id: "",
    start: 0,
    active: false,
    off: false,
    micMuted: false,
    lastClick: 0,
    lastVoice: 0,
    openedAt: 0,
    lastQuestion: 0,
    questions: 0,
    guardrail: false,
    pending: [] as Moment[],
    recent: [] as Moment[],
    idleChecked: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const voiceSettings = useVoiceSettings();
  const conversation = useConversation({
    onMessage: (message) => {
      const s = state.current;
      if (!s.active || s.off) return;
      const row: Transcript = {
        id: crypto.randomUUID(),
        t: (Date.now() - s.start) / 1000,
        source: message.source,
        text: message.message,
      };
      if (row.text.startsWith("[APP CUE]")) return;
      setTranscript((t) => [...t, row]);
      void patch("transcript", { text: row.text, source: row.source }).catch(
        (e) => setError(e.message),
      );
    },
    onDisconnect: () => {
      if (state.current.active) {
        state.current.active = false;
        screen.stop();
        setActive(false);
        void patch("end").catch((e) => setError(e.message));
        setError("Voice disconnected. Your capture has been saved.");
      }
    },
    onError: (message) => setError(String(message)),
  });
  async function patch(action: string, extra: Record<string, unknown> = {}) {
    const s = state.current;
    if (!s.id) return;
    const r = await fetch(`/api/sessions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        t: s.start ? (Date.now() - s.start) / 1000 : 0,
        ...extra,
      }),
    });
    if (!r.ok) {
      const b = await r.json();
      throw new Error(b.error);
    }
    return r.json();
  }
  // The expert rested the cursor in the help corner: feedback is welcome now.
  function requestHelp(invoice?: string): HelpReply {
    const s = state.current;
    if (!s.active)
      return { ok: false, message: "Start the capture first" };
    if (s.off) return { ok: false, message: "Off the record" };
    if (conversation.status !== "connected")
      return { ok: false, message: "Voice not connected" };
    const now = Date.now();
    s.lastQuestion = now;
    s.lastClick = now;
    s.idleChecked = true;
    setHelps((n) => n + 1);
    conversation.sendUserMessage(
      `[APP CUE] HELP: ${expert} rested their cursor in the help corner and is inviting your feedback now${invoice ? ` on invoice ${invoice}` : ""}. Recent screen moments: ${JSON.stringify(s.recent.map((e) => ({ summary: e.summary, why: e.unanswered_why })))}. In at most 30 words, share one thing you noticed that seems inconsistent or worth double-checking, or ask your most important open question about their reasoning. Never invent a policy.`,
    );
    return { ok: true, message: "Apprentice is responding…" };
  }
  useConversationClientTool(
    "lookup_guardrails",
    () =>
      "No confirmed Work Map exists during capture. Ask the expert about limits and exceptions; never invent a rule.",
  );
  const screen = useScreenCapture(
    (moments) => {
      setEvents((e) => [...e, ...moments]);
      const s = state.current;
      s.recent = [...s.recent, ...moments].slice(-3);
      if (moments.some((e) => e.type.includes("open") || e.field === "invoice"))
        s.openedAt = Date.now();
      s.pending.push(...moments.filter((e) => e.decision_worthy));
      if (conversation.status === "connected" && !s.off)
        conversation.sendContextualUpdate(
          moments
            .map(
              (e) =>
                `[SCREEN ${stamp(e.t)}] ${e.summary}. Unanswered why: ${e.unanswered_why || "none"}`,
            )
            .join("\n"),
        );
    },
    setError,
    () => {
      state.current.active = false;
      setActive(false);
      void conversation.endSession();
      void patch("end").catch((e) => setError(e.message));
      setError("Screen sharing stopped. This capture has been saved.");
    },
  );
  useEffect(() => {
    const c = new BroadcastChannel(
      `apprentice-erp-${session?.id || "unpaired"}`,
    );
    channel.current = c;
    c.onmessage = (e) => {
      if (e.data?.type === "ready") {
        setPaired(true);
        return;
      }
      if (e.data?.type === "help") {
        const reply = requestHelp(e.data.invoice || undefined);
        setHelpReply(reply);
        c.postMessage({ type: "help-ack", ...reply });
        return;
      }
      const s = state.current;
      if (e.data?.type !== "click" || !s.active || s.off) return;
      s.lastClick = Date.now();
      s.idleChecked = false;
      setClicks((n) => n + 1);
      if (conversation.status === "connected") conversation.sendUserActivity();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void screen.click(), 350);
    };
    c.postMessage({ type: "ping" });
    return () => {
      c.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [session?.id, conversation.status]);
  useEffect(() => {
    const id = setInterval(() => {
      const s = state.current;
      if (!s.active) return;
      const now = Date.now();
      setElapsed((now - s.start) / 1000);
      if (s.off || conversation.status !== "connected") return;
      if (!s.micMuted && conversation.getInputVolume() > 0.04)
        s.lastVoice = now;
      const cue = cueFor({
        now,
        lastClick: s.lastClick,
        lastVoice: s.lastVoice,
        openedAt: s.openedAt,
        lastQuestion: s.lastQuestion,
        questions: s.questions,
        speaking: conversation.isSpeaking,
        paused: s.off,
        pending: s.pending.length > 0,
        idleChecked: s.idleChecked,
        micMuted: s.micMuted,
      });
      if (!cue) return;
      s.lastQuestion = now;
      s.idleChecked = true;
      if (cue === "idle") {
        conversation.sendUserMessage(
          `[APP CUE] No ERP clicks for 15 seconds. Ask once, gently: Is everything okay, or are you thinking through something? Do not assume anything is wrong. ${s.micMuted ? "The expert has deliberately muted their microphone to test the idle timer. Ask this check-in once, then stay silent; no follow-ups while muted." : ""}`,
        );
        return;
      }
      const forceGuardrail = s.questions >= 2 && !s.guardrail;
      const top = [...s.pending].reverse().slice(0, 3);
      s.pending = [];
      s.questions++;
      s.guardrail ||= forceGuardrail;
      setQuestions(s.questions);
      setGuardrail(s.guardrail);
      conversation.sendUserMessage(
        `[APP CUE] Ask one question, at most 20 words, about the reasoning behind these moments: ${JSON.stringify(top.map((e) => ({ summary: e.summary, why: e.unanswered_why })))}. ${forceGuardrail ? "This question MUST ask about a limit, exception or when to stop and ask." : "Ask why, never what is already on screen."}`,
      );
      void patch("question", { guardrail: forceGuardrail }).catch((e) =>
        setError(e.message),
      );
    }, 250);
    return () => clearInterval(id);
  }, [conversation]);
  useEffect(() => {
    const id = setInterval(() => {
      if (
        state.current.active &&
        !state.current.off &&
        conversation.status === "connected"
      )
        conversation.sendUserActivity();
    }, 10000);
    return () => clearInterval(id);
  }, [conversation]);
  useEffect(() => {
    const finish = () => {
      const s = state.current;
      if (!s.active) return;
      s.active = false;
      screen.stop();
      void conversation.endSession();
      void fetch(`/api/sessions/${s.id}`, {
        method: "PATCH",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end",
          t: (Date.now() - s.start) / 1000,
        }),
      }).catch(() => {});
    };
    window.addEventListener("pagehide", finish);
    return () => {
      window.removeEventListener("pagehide", finish);
      finish();
    };
  }, []);
  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expert }),
      });
      const s = await r.json();
      if (!r.ok) throw new Error(s.error || "Could not create session");
      state.current.id = s.id;
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await screen.share(session.id, () =>
        state.current.start ? (Date.now() - state.current.start) / 1000 : 0,
      );
      const r = await fetch("/api/el-token");
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          conversation.endSession();
          reject(new Error("Voice connection timed out. Please try again."));
        }, 30000);
        conversation.startSession({
          conversationToken: b.token,
          connectionType: "webrtc",
          ...sessionVoice(voiceSettings.ref.current),
          dynamicVariables: {
            expert_name: expert,
            ...sessionVoice(voiceSettings.ref.current).dynamicVariables,
          },
          onConnect: () => {
            clearTimeout(timeout);
            resolve();
          },
          onError: (message) => {
            clearTimeout(timeout);
            reject(new Error(String(message)));
          },
        });
      });
      const now = Date.now();
      Object.assign(state.current, {
        start: now,
        active: true,
        lastClick: now,
        lastVoice: now,
        openedAt: now,
        lastQuestion: now - 20000,
      });
      setActive(true);
    } catch (e) {
      screen.stop();
      setError(e instanceof Error ? e.message : "Could not start capture");
    } finally {
      setBusy(false);
    }
  }
  async function toggle() {
    setBusy(true);
    try {
      const next = !state.current.off;
      state.current.off = next;
      screen.setPaused(next);
      conversation.setMuted(next || state.current.micMuted);
      setOff(next);
      if (timer.current) clearTimeout(timer.current);
      await patch(next ? "pause" : "resume");
      if (!next) {
        state.current.lastClick = Date.now();
        state.current.idleChecked = false;
        state.current.pending = [];
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function toggleMicrophone() {
    try {
      const s = state.current;
      const next = !s.micMuted;
      conversation.setMuted(next || s.off);
      s.micMuted = next;
      // Give the test a fresh 15-second window, then rearm only on ERP clicks.
      s.lastClick = Date.now();
      s.lastVoice = next ? Date.now() - 1500 : Date.now();
      s.idleChecked = false;
      setMicMuted(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change microphone");
    }
  }
  async function end() {
    setBusy(true);
    state.current.active = false;
    screen.stop();
    try {
      if (rawConversation) await rawConversation.endSession();
      else conversation.endSession();
      await patch("end");
      window.location.href = `/debrief/${session!.id}`;
    } catch (e) {
      setError(String(e));
      setBusy(false);
      setActive(false);
    }
  }
  return (
    <main className="capture">
      <HelpCorner
        reply={helpReply}
        label="Invite feedback"
        onHelp={() => setHelpReply(requestHelp())}
      />
      <div className="page-title">
        <div>
          <div className="eyebrow">MODULE 01 / CAPTURE</div>
          <h1>Your work. Your judgment.</h1>
          <p>Work as usual. Your apprentice asks when you pause.</p>
        </div>
        <div className={`status ${off ? "paused" : ""}`}>
          <span />{" "}
          {off
            ? "Off the record"
            : active
              ? conversation.isSpeaking
                ? "Speaking"
                : micMuted
                  ? "Watching · microphone muted"
                  : "Watching & listening"
              : "Ready when you are"}
        </div>
      </div>
      <div className="capture-grid">
        <section>
          <div className="panel preview">
            {screen.sharing ? (
              <>
                <div className="capture-orb">観</div>
                <h2>
                  {off ? "A private moment" : "The apprentice is with you"}
                </h2>
                <p>
                  {off
                    ? "Screenshots and microphone are paused."
                    : "One screenshot after an ERP click. None while you’re idle."}
                </p>
                <div className="metrics">
                  <div>
                    <b>{stamp(elapsed)}</b>
                    <small>Session time</small>
                  </div>
                  <div>
                    <b>{screen.frames}</b>
                    <small>Screen moments</small>
                  </div>
                  <div>
                    <b>{questions} / 5</b>
                    <small>Why-question cues</small>
                  </div>
                </div>
                <small>
                  {guardrail
                    ? "✓ Guardrail question cued"
                    : "Guardrail question pending"}{" "}
                  · {clicks} clicks received
                  {helps > 0 && ` · ${helps} help requests`}
                </small>
              </>
            ) : (
              <>
                <div className="capture-orb">観</div>
                <h2>Let’s capture the reasoning</h2>
                <p>
                  Open the paired sandbox, share its tab, then process the three
                  invoices while thinking aloud.
                </p>
                <VoicePicker
                  settings={voiceSettings.settings}
                  update={voiceSettings.update}
                />
                <label>
                  Expert name
                  <input
                    value={expert}
                    disabled={!!session}
                    onChange={(e) => setExpert(e.target.value)}
                  />
                </label>
                {!session ? (
                  <button className="primary" disabled={busy} onClick={prepare}>
                    Prepare session →
                  </button>
                ) : (
                  <>
                    <a
                      className="button"
                      href={`/erp?case=expert&capture=${session.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      1. Open paired invoice sandbox ↗
                    </a>
                    <button
                      className="primary"
                      disabled={busy || !paired}
                      onClick={start}
                    >
                      {busy ? "Connecting…" : "2. Share ERP tab & start"}
                    </button>
                    <small>
                      {paired
                        ? "✓ Sandbox connected"
                        : "Waiting for the paired sandbox to open"}
                    </small>
                  </>
                )}
              </>
            )}{" "}
          </div>
          {active && (
            <>
              <div className="actions">
                <button
                  disabled={busy || off}
                  aria-pressed={micMuted}
                  onClick={toggleMicrophone}
                >
                  {micMuted ? "Unmute microphone" : "Mute microphone"}
                </button>
                <button disabled={busy} onClick={toggle}>
                  {off ? "Resume capture" : "Off the record"}
                </button>
                <button className="primary" disabled={busy} onClick={end}>
                  End task → Debrief
                </button>
              </div>
              {micMuted && !off && (
                <p role="status" className="muted">
                  Microphone muted. Screen capture continues.{" "}
                  {state.current.idleChecked
                    ? "Check-in sent once. Click in the ERP to restart the timer."
                    : `Idle check-in in ${Math.max(0, Math.ceil((15000 - (Date.now() - state.current.lastClick)) / 1000))}s${conversation.isSpeaking ? " · waiting for the apprentice to finish speaking" : ""}.`}
                </p>
              )}
            </>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <div className="note">
            <b>You control the record.</b>
            <p>
              Screen moments stay on this computer. Click screenshots go to
              Anthropic for analysis; microphone audio goes to ElevenLabs. Off
              the record pauses both. Headphones help prevent echo.
            </p>
            <p>
              After 15 seconds without a click, the apprentice checks in once
              when you’re quiet. Use Mute microphone to test the timer in a
              noisy room; you can still hear the apprentice.
            </p>
            <p>
              Want the apprentice’s view? Rest your cursor in the top-right
              corner of the sandbox (or this page) and it will share what it
              noticed.
            </p>
          </div>
        </section>
        <aside className="panel feed">
          <h2>
            What I see <span className="badge">{events.length}</span>
          </h2>
          {!events.length && (
            <p className="empty">
              Your decisions will appear here after clicks in the paired
              sandbox.
            </p>
          )}
          {events.map((e) => (
            <a href={e.frame} target="_blank" key={e.id} className="moment">
              <small>
                {stamp(e.t)} · {e.invoice || "Screen"}
              </small>
              <p>{e.summary}</p>
              {e.decision_worthy && <em>Reasoning worth exploring</em>}
            </a>
          ))}
          <h2 className="transcript-title">Conversation</h2>
          {!transcript.length && (
            <p className="muted">The transcript starts when you connect.</p>
          )}
          {transcript.map((t) => (
            <div key={t.id} className="transcript">
              <small>
                {t.source === "user" ? expert : "Apprentice"} · {stamp(t.t)}
              </small>
              <p>{t.text}</p>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}
