// Voice and tone choices for the ElevenLabs agents. The tone text is sent as
// the {{interview_style}} dynamic variable; voice and speed as TTS overrides.
export const STYLES = {
  concise: {
    label: "Concise",
    hint: "Short, direct questions. No small talk.",
    text: "Be extremely concise: at most 15 words per turn, one question at a time. No greetings, filler, praise or restating what was said. Acknowledge in at most three words.",
    speed: 1.08,
  },
  balanced: {
    label: "Balanced",
    hint: "Brief and friendly.",
    text: "Be brief and friendly: at most 25 words per turn, one question at a time. Skip filler.",
    speed: 1,
  },
  coaching: {
    label: "Warm coach",
    hint: "More encouraging, still focused.",
    text: "Be warm and encouraging but focused: at most 40 words per turn, one question at a time.",
    speed: 0.95,
  },
} as const;
export type StyleId = keyof typeof STYLES;
export type VoiceSettings = { voiceId: string; style: StyleId };
export type VoiceOption = { id: string; name: string; description: string };
export const DEFAULT_VOICE: VoiceSettings = {
  voiceId: "",
  style: "concise",
};
// Fallback when the voice list cannot be loaded: ElevenLabs premade voices.
export const PREMADE_VOICES: VoiceOption[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "female · soft, professional" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "male · warm, British" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "female · confident, British" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "male · authoritative, British" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", description: "female · bright, American" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", description: "male · deep, American" },
];
export function sessionVoice(v: VoiceSettings) {
  const style = STYLES[v.style] ?? STYLES.concise;
  return {
    overrides: {
      tts: { speed: style.speed, ...(v.voiceId ? { voiceId: v.voiceId } : {}) },
    },
    dynamicVariables: { interview_style: style.text },
  };
}
