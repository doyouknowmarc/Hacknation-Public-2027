import { notFound } from "next/navigation";
import { readWorkMap } from "@/lib/workmap-store";
import Client from "./client";
export const dynamic = "force-dynamic";
export default async function Teach({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const map = await readWorkMap((await params).id).catch(() => null);
  if (!map) notFound();
  return <Client map={map} />;
}
