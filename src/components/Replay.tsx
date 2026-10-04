"use client";
import { useEffect, useState } from "react";
import { stamp } from "@/lib/types";
export default function Replay({
  frames,
  t,
  autoplay = false,
}: {
  frames: { t: number; frame: string }[];
  t: number;
  autoplay?: boolean;
}) {
  const nearby = frames.filter((f) => f.t >= t - 6 && f.t <= t + 3);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setIndex(0);
    setPlaying(autoplay);
  }, [t, autoplay]);
  useEffect(() => {
    if (!playing || nearby.length < 2) return;
    const timer = setInterval(
      () =>
        setIndex((i) => {
          if (i + 1 >= nearby.length) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      900,
    );
    return () => clearInterval(timer);
  }, [playing, nearby.length]);
  const frame = nearby[Math.min(index, nearby.length - 1)];
  return (
    <div className="replay">
      {frame && (
        <img
          className="evidence-image"
          src={frame.frame}
          alt={`Captured ERP moment at ${stamp(frame.t)}`}
        />
      )}
      <div className="actions">
        <button
          disabled={nearby.length < 2}
          onClick={() => {
            setIndex(0);
            setPlaying(true);
          }}
        >
          {playing ? "Replaying…" : "Replay nearby clicks"}
        </button>
        <span className="muted">
          {frame ? stamp(frame.t) : "No nearby frames"} · {nearby.length}{" "}
          click-captured frames
        </span>
      </div>
      <small>
        Only moments captured after clicks are available; gaps are not
        reconstructed.
      </small>
    </div>
  );
}
