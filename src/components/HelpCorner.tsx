"use client";
import { useEffect, useRef, useState } from "react";
// Hot corner: resting the cursor here for a moment tells the voice agent that
// feedback is welcome. Leaving and re-entering asks again after a cooldown.
const DWELL = 700;
const COOLDOWN = 8000;
export type HelpReply = { ok: boolean; message: string };
export default function HelpCorner({
  onHelp,
  reply,
  label = "Ask for help",
}: {
  onHelp: () => void;
  reply: HelpReply | null;
  label?: string;
}) {
  const [phase, setPhase] = useState<"idle" | "arming" | "sent">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(0);
  useEffect(() => {
    document.body.classList.add("has-help-corner");
    return () => {
      document.body.classList.remove("has-help-corner");
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  function enter() {
    if (Date.now() - last.current < COOLDOWN) {
      setPhase("sent");
      return;
    }
    setPhase("arming");
    timer.current = setTimeout(() => {
      last.current = Date.now();
      setPhase("sent");
      onHelp();
    }, DWELL);
  }
  function leave() {
    if (timer.current) clearTimeout(timer.current);
    setPhase("idle");
  }
  const message =
    phase === "sent"
      ? reply?.message || "Asking the apprentice…"
      : phase === "arming"
        ? "Hold here…"
        : label;
  return (
    <div
      className={`help-corner ${phase} ${phase === "sent" && reply && !reply.ok ? "failed" : ""}`}
      onMouseEnter={enter}
      onMouseLeave={leave}
      role="status"
      aria-live="polite"
      title="Rest your cursor here to invite feedback from the voice agent"
    >
      <span className="help-corner-icon" aria-hidden>
        助
      </span>
      <span>{message}</span>
    </div>
  );
}
