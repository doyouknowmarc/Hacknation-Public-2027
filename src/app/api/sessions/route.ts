import { createSession, listSessions } from "@/lib/store";
export async function GET() {
  return Response.json(await listSessions());
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    return Response.json(
      await createSession(String(body.expert || "Sabine").slice(0, 80)),
      { status: 201 },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not create session" },
      { status: 500 },
    );
  }
}
