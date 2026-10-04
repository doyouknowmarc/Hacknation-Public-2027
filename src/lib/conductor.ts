export type Timing = {
  now: number;
  lastClick: number;
  lastVoice: number;
  openedAt: number;
  lastQuestion: number;
  questions: number;
  speaking: boolean;
  paused: boolean;
  pending: boolean;
  idleChecked: boolean;
  micMuted?: boolean;
};
export function cueFor(s: Timing): "decision" | "idle" | null {
  if (s.paused || s.speaking) return null;
  // Muted test mode ignores room noise and waits for one idle check-in.
  if (s.micMuted)
    return s.now - s.lastClick >= 15000 && !s.idleChecked ? "idle" : null;
  if (
    s.now - s.lastVoice < 1500 ||
    s.now - s.lastClick < 2500 ||
    s.now - s.openedAt < 6000 ||
    s.now - s.lastQuestion < 20000
  )
    return null;
  if (s.pending && s.questions < 5) return "decision";
  if (s.now - s.lastClick >= 15000 && !s.idleChecked) return "idle";
  return null;
}
