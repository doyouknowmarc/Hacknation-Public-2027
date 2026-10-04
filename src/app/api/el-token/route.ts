import { eleven } from "@/lib/elevenlabs";
export async function GET(req: Request) {
  try {
    const role = new URL(req.url).searchParams.get("role") || "capture";
    if (!["capture", "debrief", "tutor"].includes(role))
      return Response.json({ error: "Unknown agent role" }, { status: 400 });
    const id =
      role === "tutor"
        ? process.env.ELEVENLABS_TUTOR_AGENT_ID
        : role === "debrief"
          ? process.env.ELEVENLABS_DEBRIEF_AGENT_ID
          : process.env.ELEVENLABS_CAPTURE_AGENT_ID;
    if (!id)
      throw new Error(
        "Run npm run setup:agents to configure the voice agents.",
      );
    return Response.json(
      await eleven(
        `/convai/conversation/token?agent_id=${encodeURIComponent(id)}`,
      ),
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not connect voice" },
      { status: 503 },
    );
  }
}
