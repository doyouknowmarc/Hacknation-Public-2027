export async function GET() {
  return Response.json({
    vision: !!process.env.ANTHROPIC_API_KEY,
    voice: !!process.env.ELEVENLABS_CAPTURE_AGENT_ID,
  });
}
