import { sessionKey } from "@/lib/store";
import { readBytes } from "@/lib/storage";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ sid: string; n: string }> },
) {
  try {
    const { sid, n } = await params;
    if (!/^\d+$/.test(n)) throw new Error();
    const jpeg = await readBytes(sessionKey(sid, `frames/${n}.jpg`));
    if (!jpeg) throw new Error();
    return new Response(new Uint8Array(jpeg), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, no-store",
        },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
