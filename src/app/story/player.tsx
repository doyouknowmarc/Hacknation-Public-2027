"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SPEAKERS,
  cuts,
  spoken,
  storyInvoices,
  storyLines,
  type Action,
  type Chapter,
  type Cut,
  type Line,
  type Rule,
  type Scene,
} from "@/lib/story";
import { euro } from "@/lib/invoices";

type View = {
  scene: Scene;
  chapter: Chapter;
  card: {
    title: string;
    body?: string;
    switchTo?: { speaker: Line["speaker"]; label: string };
    leaving?: boolean;
  } | null;
  rules: Rule[];
  selected: string;
  status: Record<string, string>;
  modal: "approve" | "approval" | null;
  approver: string;
  note: string;
  review: "idle" | "pending" | "stop" | "ok";
  seen: { text: string; tacit?: boolean }[];
  lines: Line[];
  caption: Line | null;
  speaking: Line["speaker"] | null;
};
const initial: View = {
  scene: "expert",
  chapter: "capture",
  card: null,
  rules: [],
  selected: "",
  status: {},
  modal: null,
  approver: "",
  note: "",
  review: "idle",
  seen: [],
  lines: [],
  caption: null,
  speaking: null,
};
const CHAPTERS: { id: Chapter; label: string; kanji: string }[] = [
  { id: "capture", label: "Capture", kanji: "観" },
  { id: "debrief", label: "Debrief", kanji: "問" },
  { id: "map", label: "Work Map", kanji: "型" },
  { id: "teach", label: "Teach", kanji: "教" },
];
const SCENE_CHAPTER: Record<Scene, Chapter> = {
  expert: "capture",
  debrief: "debrief",
  map: "map",
  intern: "teach",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// With ?record=1 the player logs when each clip starts, so a recording
// script can rebuild the soundtrack (see scripts/record-story.mjs).
type RecEvent = { type: "start" | "clip" | "end"; t: number; id?: string; rate?: number };
const recLog = (e: Omit<RecEvent, "t">) => {
  const w = window as unknown as { __story?: RecEvent[] };
  if (w.__story) w.__story.push({ ...e, t: Date.now() });
};

// Live voice waveform: bars follow the playing clip through an AnalyserNode.
function Wave({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    if (!active || !analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      bars.current.forEach((el, i) => {
        if (!el) return;
        const v = data[1 + i * 2] / 255;
        el.style.transform = `scaleY(${0.15 + v * 0.85})`;
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [active, analyser]);
  return (
    <span className={`wave ${active ? "on" : ""}`} aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} ref={(el) => void (bars.current[i] = el)} />
      ))}
    </span>
  );
}

// Plays only after a press of its own Play button: no autoplay.
export default function StoryPlayer({
  autostart = false,
  onClose,
}: {
  // Opened from the landing page's Demo button: start at once (the click
  // already allowed audio) and offer a way back to the page.
  autostart?: boolean;
  onClose?: () => void;
} = {}) {
  const [view, setView] = useState<View>(initial);
  const [showFull, setShowFull] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const graph = useRef<{ ctx: AudioContext; node: AnalyserNode; wired: Set<string> } | null>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "done">("ready");
  const [cursor, setCursor] = useState({ x: -60, y: -60, down: false });
  const run = useRef(0);
  const audio = useRef<Record<string, HTMLAudioElement>>({});
  const set = (p: Partial<View> | ((v: View) => Partial<View>)) =>
    setView((v) => ({ ...v, ...(typeof p === "function" ? p(v) : p) }));

  useEffect(() => {
    // The 2-minute cut is hidden; /?full=1 shows it again.
    const params = new URLSearchParams(window.location.search);
    setShowFull(params.has("full"));
    if (params.has("record")) (window as unknown as { __story: RecEvent[] }).__story = [];
    if (autostart) void play("one");
    for (const l of storyLines()) {
      const a = new Audio(`/story/${l.id}.mp3`);
      a.preload = "auto";
      a.playbackRate = SPEAKERS[l.speaker].rate ?? 1;
      audio.current[l.id] = a;
    }
    return () => {
      run.current++;
      Object.values(audio.current).forEach((a) => a.pause());
    };
  }, []);

  function apply(a: Action) {
    if (a.type === "select")
      set({ selected: a.id, modal: null, approver: "", note: "", review: "idle" });
    if (a.type === "modal") set({ modal: a.modal, review: "idle" });
    if (a.type === "approver") set({ approver: a.value });
    if (a.type === "note") set({ note: a.value });
    if (a.type === "review") set({ review: a.state });
    if (a.type === "complete")
      set((v) => ({
        status: { ...v.status, [v.selected]: a.status },
        modal: null,
        review: "idle",
      }));
  }
  async function moveTo(target: string, token: number) {
    const el = document.querySelector<HTMLElement>(`[data-story="${target}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCursor({ x: r.left + Math.min(r.width / 2, 60), y: r.top + r.height / 2, down: false });
    await sleep(420);
    if (token !== run.current) return;
    setCursor((c) => ({ ...c, down: true }));
    await sleep(120);
    setCursor((c) => ({ ...c, down: false }));
  }
  async function speak(line: Line, token: number) {
    set((v) => ({
      caption: line,
      lines: line.speaker === "narrator" ? v.lines : [...v.lines, line],
    }));
    const a = audio.current[line.id];
    try {
      if (!a) throw new Error("missing");
      const g = graph.current;
      if (g && !g.wired.has(line.id)) {
        g.ctx.createMediaElementSource(a).connect(g.node);
        g.wired.add(line.id);
      }
      a.currentTime = 0;
      a.playbackRate = SPEAKERS[line.speaker].rate ?? 1;
      set({ speaking: line.speaker });
      recLog({ type: "clip", id: line.id, rate: a.playbackRate });
      await new Promise<void>((resolve, reject) => {
        a.onended = () => resolve();
        a.onerror = () => reject(new Error("missing"));
        a.play().catch(reject);
      });
    } catch {
      set({ speaking: line.speaker });
      await sleep(Math.max(1400, spoken(line.text).split(/\s+/).length * 330));
    }
    set({ speaking: null });
    if (token === run.current) await sleep(100);
  }
  async function play(cut: Cut) {
    // Created on the Play press, so the browser allows audio.
    if (!graph.current) {
      const ctx = new AudioContext();
      const node = ctx.createAnalyser();
      node.fftSize = 64;
      node.smoothingTimeConstant = 0.7;
      node.connect(ctx.destination);
      graph.current = { ctx, node, wired: new Set() };
      setAnalyser(node);
    }
    void graph.current.ctx.resume();
    const token = ++run.current;
    setView(initial);
    setPhase("playing");
    recLog({ type: "start" });
    for (const step of cuts[cut].steps) {
      if (token !== run.current) return;
      switch (step.kind) {
        case "card": {
          const sw = step.switchTo;
          set((v) => ({
            card: { title: step.title, body: step.body, switchTo: sw },
            chapter: step.chapter ?? v.chapter,
            caption: null,
          }));
          if (sw) {
            // Slide covers the screen, then the scene changes underneath it.
            await sleep(450);
            set({ scene: sw.scene, chapter: SCENE_CHAPTER[sw.scene], lines: [], seen: [], selected: "", modal: null });
          }
          if (step.line) await speak(step.line, token);
          else await sleep(step.ms ?? 2200);
          if (step.hold) await sleep(step.hold);
          if (sw) {
            set((v) => ({ card: v.card && { ...v.card, leaving: true }, caption: null }));
            await sleep(450);
          }
          set({ card: null, caption: null });
          await sleep(sw ? 100 : 250);
          break;
        }
        case "scene":
          set({
            scene: step.scene,
            chapter: SCENE_CHAPTER[step.scene],
            rules: step.rules ?? [],
            ...(step.scene === "intern" || step.scene === "debrief" ? { lines: [] } : {}),
            ...(step.scene === "intern" ? { seen: [], selected: "" } : {}),
          });
          await sleep(200);
          break;
        case "say":
          await speak(step, token);
          break;
        case "click":
          await moveTo(step.target, token);
          if (step.then) apply(step.then);
          await sleep(200);
          break;
        case "type":
          await moveTo(step.target, token);
          for (let i = 1; i <= step.text.length; i++) {
            if (token !== run.current) return;
            set({ note: step.text.slice(0, i) });
            await sleep(16);
          }
          await sleep(150);
          break;
        case "act":
          apply(step.action);
          break;
        case "see":
          set((v) => ({ seen: [...v.seen, { text: step.text, tacit: step.tacit }] }));
          await sleep(250);
          break;
        case "wait":
          await sleep(step.ms);
          break;
      }
    }
    if (token === run.current) {
      recLog({ type: "end" });
      setPhase("done");
      setCursor({ x: -60, y: -60, down: false });
    }
  }

  const invoices = view.scene === "intern" ? storyInvoices.intern : storyInvoices.expert;
  const inv = invoices.find((i) => i.id === view.selected);
  const status = (id: string) => view.status[id] || "Ready for review";
  const chapterIndex = CHAPTERS.findIndex((c) => c.id === view.chapter);
  const bubbles = view.lines.filter((l) => l.speaker !== "narrator");
  return (
    <div className="story">
      <header className="story-bar">
        <Link href="/studio" className="brand">
          <span className="hanko" aria-hidden>
            先
          </span>
          Sensei
        </Link>
        <ol className="story-chapters">
          {CHAPTERS.map((c, i) => (
            <li
              key={c.id}
              className={
                view.chapter === "end" || i < chapterIndex
                  ? "done"
                  : i === chapterIndex
                    ? "current"
                    : ""
              }
            >
              <span>{c.kanji}</span>
              {c.label}
            </li>
          ))}
        </ol>
        {onClose && (
          <button className="story-close" onClick={onClose} aria-label="Close the demo">
            ✕
          </button>
        )}
      </header>

      <div className="story-stage">
        {(view.scene === "expert" || view.scene === "intern") && (
          <div className={`story-app persona-${view.scene}`}>
            <div className="story-erp panel">
              <div className="story-erp-head">
                <div>
                  <div className="eyebrow">NORDWERK SOFTWARE / ACCOUNTS PAYABLE</div>
                  <h2>Expense inbox</h2>
                </div>
                <span className={`persona-chip ${view.scene === "expert" ? "expert" : "intern"}`}>
                  {view.scene === "expert" ? "Sabine · the expert" : "Lena · the apprentice"}
                </span>
              </div>
              <div className="story-erp-grid">
                <aside className="story-list">
                  {invoices.map((x) => (
                    <button
                      key={x.id}
                      data-story={`invoice-${x.id}`}
                      className={`invoice-item ${view.selected === x.id ? "selected" : ""}`}
                    >
                      <small>INV {x.id}</small>
                      <b>{x.supplier}</b>
                      <span>{euro(x.net)} net</span>
                      <em className={`status-${status(x.id).split(" ")[0].toLowerCase()}`}>
                        {status(x.id)}
                      </em>
                    </button>
                  ))}
                </aside>
                <section className="story-paper">
                  {inv ? (
                    <>
                      <div className="paper-top">
                        <span>SUPPLIER INVOICE</span>
                        <b>#{inv.id}</b>
                      </div>
                      <h3>{inv.supplier}</h3>
                      <p>{inv.what}</p>
                      {"remark" in inv && <p className="invoice-remark">“{inv.remark}”</p>}
                      <p className="story-amount">
                        Net <b>{euro(inv.net)}</b>
                      </p>
                      <div className="po">
                        <small>SUPPORTING DOCUMENTS</small>
                        {inv.docs.map((d) => (
                          <p key={d}>{d}</p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="muted story-empty">Select an invoice</p>
                  )}
                </section>
                <section className="story-decision">
                  <h3>Decision</h3>
                  <p>
                    Status <b>{inv ? status(inv.id) : "—"}</b>
                  </p>
                  <div className="stack">
                    <button
                      className="primary"
                      data-story="approve"
                      disabled={!inv || status(inv.id) !== "Ready for review"}
                    >
                      Approve for payment
                    </button>
                    <button
                      data-story="request"
                      disabled={!inv || status(inv.id) !== "Ready for review"}
                    >
                      Request approval
                    </button>
                    <button disabled={!inv || status(inv.id) !== "Ready for review"}>
                      Hold invoice
                    </button>
                  </div>
                </section>
              </div>
              {view.modal && inv && (
                <div className="story-modal-backdrop">
                  <div className="panel modal story-modal">
                    <div className="eyebrow">INVOICE {inv.id}</div>
                    <h3>
                      {view.modal === "approve" ? "Confirm approval for payment" : "Request approval"}
                    </h3>
                    <p className="confirmation-context">
                      {inv.supplier} · {inv.what} · Net {euro(inv.net)}
                    </p>
                    {view.modal === "approval" && (
                      <>
                        <label>
                          Approver
                          <select data-story="approver" value={view.approver} onChange={() => {}}>
                            <option value="">Select…</option>
                            <option>Project lead</option>
                            <option>Finance</option>
                          </select>
                        </label>
                        <label>
                          Business justification
                          <textarea data-story="note" value={view.note} readOnly />
                        </label>
                      </>
                    )}
                    {view.scene === "intern" && view.review !== "idle" && (
                      <div className={`erp-review story-review ${view.review}`} role="status">
                        <b>
                          {view.review === "pending"
                            ? "Sensei is reviewing your decision…"
                            : view.review === "stop"
                              ? "Sabine would stop here."
                              : "✓ Decision reviewed"}
                        </b>
                        {view.review === "stop" && (
                          <p>
                            Orion already has €40 approved this month. This invoice brings it to
                            €130, above the €100 monthly allowance.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="actions">
                      <button data-story="back">Back to invoice</button>
                      <button
                        className="primary"
                        data-story="confirm"
                        disabled={view.scene === "intern" && view.review !== "ok"}
                      >
                        {view.modal === "approve" ? "Confirm & approve" : "Send approval request"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <aside className="story-sensei panel">
              <div className="story-sensei-head">
                <span className={`capture-orb story-orb ${view.speaking === "sensei" ? "speaking" : ""}`}>
                  {view.scene === "expert" ? "観" : "教"}
                </span>
                <div>
                  <b>Sensei</b>
                  <small>
                    {view.scene === "expert"
                      ? "Watching Sabine · asks when she pauses"
                      : "Coaching Lena · reviews before saving"}
                  </small>
                </div>
              </div>
              {view.scene === "expert" && (
                <div className="story-seen">
                  <h4>What I see</h4>
                  {view.seen.slice(-4).map((s, i) => (
                    <p key={i} className={s.tacit ? "tacit" : ""}>
                      {s.text}
                      {s.tacit && <em>Reasoning worth exploring</em>}
                    </p>
                  ))}
                </div>
              )}
              <div className="story-lines">
                {bubbles.slice(-6).map((l, i, all) => (
                  <div key={i} className={`story-line ${l.speaker}`}>
                    <small>
                      {SPEAKERS[l.speaker].name}
                      {i === all.length - 1 && view.speaking === l.speaker && (
                        <Wave analyser={analyser} active />
                      )}
                    </small>
                    <p>{spoken(l.text)}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}

        {view.scene === "debrief" && (
          <div className="story-debrief">
            <div className="story-debrief-head">
              <span className="capture-orb story-orb">問</span>
              <div>
                <div className="eyebrow">DEBRIEF · VOICE · ABOUT 3 MINUTES</div>
                <h2>What the screen couldn’t show</h2>
              </div>
            </div>
            <div className="story-lines big">
              {bubbles.slice(-5).map((l, i, all) => (
                <div key={i} className={`story-line ${l.speaker}`}>
                  <small>
                    {SPEAKERS[l.speaker].name}
                    {i === all.length - 1 && view.speaking === l.speaker && (
                      <Wave analyser={analyser} active />
                    )}
                  </small>
                  <p>{spoken(l.text)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {view.scene === "map" && (
          <div className="story-map">
            <div className="eyebrow">CONFIRMED WORK MAP</div>
            <h2>Sabine’s expense judgment</h2>
            <div className="map-chips">
              <span>✓ Confirmed by Sabine</span>
            </div>
            <div className="story-rules single">
              {view.rules.map((r) => (
                <article key={r.rule} className="panel">
                  <span className="stage-kanji">型</span>
                  <h3>{r.rule}</h3>
                  <blockquote className="expert-quote">
                    “{r.quote}”<footer>Sabine · debrief</footer>
                  </blockquote>
                  <div className="map-chips">
                    <span>Responsible: {r.owner}</span>
                    <span>Release when: {r.release}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {view.card && !view.card.switchTo && (
          <div className="story-card" key={view.card.title}>
            <h1>{view.card.title}</h1>
            {view.card.body && <p>{view.card.body}</p>}
          </div>
        )}
        {view.card?.switchTo && (
          <div
            className={`story-switch ${view.card.switchTo.speaker} ${view.card.leaving ? "leaving" : ""}`}
            key={view.card.title}
          >
            <span className="story-switch-kanji" aria-hidden>
              教
            </span>
            <div>
              <small>{view.card.switchTo.label}</small>
              <h1>{view.card.title}</h1>
              {view.card.body && <p>{view.card.body}</p>}
            </div>
          </div>
        )}

        {phase !== "playing" && (
          <div className="story-start">
            <div className="calligraphy-kanji">先生</div>
            <h1>{phase === "done" ? "That’s Sensei." : "Watch the work. Learn the why."}</h1>
            <p>
              Sabine approves a Claude invoice. Sensei learns why, and stops Lena, a new hire,
              before she gets a similar one wrong.
            </p>
            <div className="actions">
              <button className="primary story-play" onClick={() => void play("one")}>
                ▶ Demo
              </button>
              <Link className="button story-play" href="/studio">
                Open app
              </Link>
              {onClose && (
                <button className="story-play" onClick={onClose}>
                  Back to the page
                </button>
              )}
              {showFull && (
                <button className="story-play" onClick={() => void play("two")}>
                  ▶ Long cut · 2 min
                </button>
              )}
            </div>
            <small>Under a minute · sound on · voices by ElevenLabs v4</small>
          </div>
        )}
      </div>

      {view.caption && phase === "playing" && view.scene !== "debrief" && (
        <div className={`story-caption ${view.caption.speaker}`}>
          <span className="speaker-chip">
            <Wave analyser={analyser} active={view.speaking === view.caption.speaker} />
            {SPEAKERS[view.caption.speaker].name}
            {SPEAKERS[view.caption.speaker].role && (
              <small>{SPEAKERS[view.caption.speaker].role}</small>
            )}
          </span>
          <span className="caption-text">{spoken(view.caption.text)}</span>
        </div>
      )}
      <div
        className={`story-cursor ${cursor.down ? "down" : ""}`}
        style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        aria-hidden
      />
    </div>
  );
}
