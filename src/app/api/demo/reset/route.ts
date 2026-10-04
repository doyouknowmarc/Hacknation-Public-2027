import { resetDemo } from "@/lib/demo";
export async function POST() {
  try {
    return Response.json(await resetDemo());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Reset failed" },
      { status: 500 },
    );
  }
}
