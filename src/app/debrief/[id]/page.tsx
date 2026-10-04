import { notFound } from "next/navigation";
import { readSession } from "@/lib/store";
import { readDebrief, readWorkMap } from "@/lib/workmap-store";
import DebriefPage from "./client";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;
  const session = await readSession(id).catch(() => null);
  if (!session) notFound();
  return (
    <DebriefPage
      session={session}
      initial={await readDebrief(id)}
      mapReady={!!(await readWorkMap(id))}
    />
  );
}
