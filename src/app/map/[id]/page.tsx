import { notFound } from "next/navigation";
import { readWorkMap } from "@/lib/workmap-store";
import WorkMapView from "./view";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const map = await readWorkMap((await params).id).catch(() => null);
  if (!map) notFound();
  return <WorkMapView initial={map} />;
}
