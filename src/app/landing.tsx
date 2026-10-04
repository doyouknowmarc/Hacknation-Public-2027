"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import StoryPlayer from "./story/player";

const WHY = ["Why?", "Warum?", "Pourquoi?", "¿Por qué?", "なぜ？"];

const steps = [
  {
    kanji: "観",
    name: "Capture",
    tag: "watch & ask why",
    text: "Sensei sits quietly beside the expert while she works in her usual tools. Each click becomes one screenshot that AI reads. When she pauses, a voice agent asks why.",
    example: "“Is that €100 limit per invoice, or per project, per month?”",
  },
  {
    kanji: "型",
    name: "Work Map",
    tag: "rules, confirmed",
    text: "Her answers become rules, each linked to the moment on screen and her own words. Sensei reads the rules back in under a minute, and she confirms them.",
    example: "IF Claude spend > €100 per project per month → THEN the project lead approves.",
  },
  {
    kanji: "教",
    name: "Teach",
    tag: "guide new hires",
    text: "A tutor watches the new hire on real cases. Before a wrong decision is saved, it stops her, explains why with the expert’s words, and lets her fix it herself.",
    example: "€90 invoice + €40 already spent = €130 → send to the project lead.",
  },
];

const benefits = [
  {
    title: "No forms. No extra meetings.",
    text: "Experts keep working. Sensei asks a few questions at natural pauses and offers a draft to confirm. Nobody has to write documentation.",
  },
  {
    title: "Captures the why, not just the what",
    text: "Manuals say what to do. Sensei captures the conditions, limits and exceptions experts check before they decide.",
  },
  {
    title: "Every rule has a source",
    text: "Each rule links to the screen moment and the expert’s exact words, and the expert confirms it. Nothing is invented.",
  },
  {
    title: "Mistakes stopped before they happen",
    text: "The tutor reviews a decision before it is saved, not after the payment run. New hires learn from a near miss, not a real one.",
  },
  {
    title: "Any language",
    text: "Warum, pourquoi, ¿por qué?: experts answer in the language they think in. The rules work for everyone.",
  },
  {
    title: "The expert controls the record",
    text: "Screenshots only after clicks, never while idle. Off the record pauses screen and microphone. A help corner asks Sensei only when you want it.",
  },
];

export default function Landing() {
  const [demo, setDemo] = useState(false);
  const [why, setWhy] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setWhy((i) => (i + 1) % WHY.length), 1400);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    document.body.style.overflow = demo ? "hidden" : "";
  }, [demo]);

  const cta = (
    <div className="actions">
      <button className="primary story-play" onClick={() => setDemo(true)}>
        ▶ Demo
      </button>
      <Link className="button story-play" href="/studio">
        Open app
      </Link>
    </div>
  );
  return (
    <>
      <main className="landing">
        <section className="landing-hero">
          <div>
            <h1>In every company, someone just knows.</h1>
            <p className="lead">
              Which invoice to approve. Which one to hold. <em>And why.</em> Sensei captures
              that judgment while experts work, has them confirm it, and teaches it to the next
              person.
            </p>
            {cta}
            <small>One-minute demo · sound on</small>
          </div>
          <div className="calligraphy" aria-hidden>
            <p className="calligraphy-kanji">先生</p>
            <span className="hanko">道場</span>
          </div>
        </section>
        <a className="scroll-hint" href="#problem">
          Why it matters ↓
        </a>

        <section id="problem" className="landing-section">
          <div className="eyebrow">THE PROBLEM</div>
          <h2>When she retires, her know-how walks out the door.</h2>
          <p className="lead">
            Most of it was never written down. It lives in the heads of people who have done the
            work for years, and leaves when they do.
          </p>
          <div className="gap-grid">
            <article className="panel gap-what">
              <small>The manual</small>
              <h3>What to do.</h3>
              <p>“Software invoices are approved by accounts payable.”</p>
            </article>
            <article className="panel gap-why">
              <small>The expert</small>
              <h3>Why.</h3>
              <p>
                €180 software invoice. Approve? <b>“It depends.”</b> On the project, the month,
                the budget.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-section">
          <div className="eyebrow">HOW IT WORKS</div>
          <h2>From one expert to every new hire.</h2>
          <div className="landing-steps">
            {steps.map((s, i) => (
              <article key={s.name} className="panel">
                <span className="stage-kanji">{s.kanji}</span>
                <small>
                  {i + 1} · {s.tag}
                </small>
                <h3>{s.name}</h3>
                <p>{s.text}</p>
                <p className="landing-example">{s.example}</p>
              </article>
            ))}
          </div>
          <div className="why-strip" aria-live="off">
            <span className="capture-orb story-orb">観</span>
            <span className="why-word" key={why}>
              {WHY[why]}
            </span>
            <span className="muted">Sensei asks in the language the expert thinks in.</span>
          </div>
        </section>

        <section className="landing-section">
          <div className="eyebrow">WHY TEAMS USE IT</div>
          <h2>Know-how that compounds.</h2>
          <div className="benefit-grid">
            {benefits.map((b) => (
              <article key={b.title}>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section compound">
          <div className="compound-loop" aria-hidden>
            <span className="node n1">観 Capture</span>
            <span className="node n2">型 Work Map</span>
            <span className="node n3">教 Teach</span>
            <span className="core">
              Knowledge
              <br />
              base
            </span>
          </div>
          <div>
            <div className="eyebrow">THE BIGGER PICTURE</div>
            <h2>Every expert. Every decision. One knowledge base that keeps growing.</h2>
            <p className="lead">
              Each answer adds a piece. Confirmed rules, expert quotes and screen moments build up
              into knowledge that never walks out the door.
            </p>
            <div className="audience">
              <article>
                <small>Today</small>
                <h3>New colleagues</h3>
                <p>learn the why from day one, on real cases.</p>
              </article>
              <article>
                <small>Tomorrow</small>
                <h3>AI agents</h3>
                <p>act on the same confirmed rules, with the expert’s reasoning attached.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="eyebrow">HOW IT’S BUILT</div>
          <h2>Works beside the tools teams already use.</h2>
          <div className="built-grid">
            <article>
              <small>Browser</small>
              <h3>Expert at work</h3>
              <p>Works as usual in the ERP, with the tab shared.</p>
            </article>
            <article>
              <small>Claude Haiku · ElevenLabs</small>
              <h3>Capture</h3>
              <p>One screenshot per click, read by AI. A voice agent asks why at pauses.</p>
            </article>
            <article>
              <small>Claude Opus</small>
              <h3>Work Map</h3>
              <p>Answers become rules, with quotes and screen moments. The expert confirms.</p>
            </article>
            <article>
              <small>ElevenLabs agent</small>
              <h3>Teach</h3>
              <p>A tutor watches the new hire, stops a wrong save and explains why.</p>
            </article>
          </div>
        </section>

        <section className="landing-final">
          <h2>Sensei, teach the next generation.</h2>
          <p>See Sabine’s judgment captured and passed on to Lena in one minute.</p>
          {cta}
        </section>
      </main>
      {demo && <StoryPlayer autostart onClose={() => setDemo(false)} />}
    </>
  );
}
