"use client";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_VOICE,
  PREMADE_VOICES,
  STYLES,
  type StyleId,
  type VoiceOption,
  type VoiceSettings,
} from "@/lib/voice";
const KEY = "apprentice-voice";
// Shared across Capture, Debrief and Teach; remembered in this browser.
export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE);
  const ref = useRef(settings);
  ref.current = settings;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setSettings({ ...DEFAULT_VOICE, ...JSON.parse(saved) });
    } catch {}
  }, []);
  function update(next: Partial<VoiceSettings>) {
    setSettings((s) => {
      const value = { ...s, ...next };
      try {
        localStorage.setItem(KEY, JSON.stringify(value));
      } catch {}
      return value;
    });
  }
  return { settings, ref, update };
}
export default function VoicePicker({
  settings,
  update,
  connected,
}: {
  settings: VoiceSettings;
  update: (next: Partial<VoiceSettings>) => void;
  connected?: boolean;
}) {
  const [voices, setVoices] = useState<VoiceOption[]>(PREMADE_VOICES);
  const [fallback, setFallback] = useState("");
  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((b) => {
        setVoices(b.voices);
        setFallback(b.defaultVoiceId);
      })
      .catch(() => {});
  }, []);
  const voiceId = settings.voiceId || fallback;
  return (
    <div className="voice-picker">
      <label>
        Voice
        <select
          value={voiceId}
          onChange={(e) => update({ voiceId: e.target.value })}
        >
          {voiceId && !voices.some((v) => v.id === voiceId) && (
            <option value={voiceId}>Agent default</option>
          )}
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.description ? ` — ${v.description}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tone
        <select
          value={settings.style}
          onChange={(e) => update({ style: e.target.value as StyleId })}
        >
          {(Object.keys(STYLES) as StyleId[]).map((id) => (
            <option key={id} value={id}>
              {STYLES[id].label} — {STYLES[id].hint}
            </option>
          ))}
        </select>
      </label>
      {connected && <small>Voice and tone changes apply the next time voice connects.</small>}
    </div>
  );
}
