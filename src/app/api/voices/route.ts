import { eleven } from "@/lib/elevenlabs";
import { PREMADE_VOICES, type VoiceOption } from "@/lib/voice";
export async function GET() {
  try {
    const b = await eleven("/voices");
    const voices: VoiceOption[] = (b.voices ?? []).map(
      (v: {
        voice_id: string;
        name: string;
        category?: string;
        labels?: Record<string, string>;
      }) => ({
        id: v.voice_id,
        name: v.name.split(" - ")[0],
        description: [v.labels?.gender, v.labels?.description || v.labels?.descriptive, v.labels?.accent]
          .filter(Boolean)
          .join(" · ") || v.category || "",
      }),
    );
    return Response.json({
      voices: voices.length ? voices : PREMADE_VOICES,
      defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || PREMADE_VOICES[0].id,
    });
  } catch {
    return Response.json({
      voices: PREMADE_VOICES,
      defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || PREMADE_VOICES[0].id,
    });
  }
}
