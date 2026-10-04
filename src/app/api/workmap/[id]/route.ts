import { readWorkMap } from "@/lib/workmap-store";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const map = await readWorkMap((await params).id);
    if (!map)
      return Response.json(
        { error: "Work Map not finalized" },
        { status: 404 },
      );
    return Response.json(map, {
      headers: {
        "Content-Disposition": `attachment; filename="work-map-${map.id}.json"`,
      },
    });
  } catch {
    return Response.json({ error: "Work Map not found" }, { status: 404 });
  }
}
