"use client";
import { ConversationProvider } from "@elevenlabs/react";
import type { WorkMap } from "@/lib/workmap-types";
import Studio from "./studio";
export default function Client({ map }: { map: WorkMap }) {
  return (
    <ConversationProvider>
      <Studio map={map} />
    </ConversationProvider>
  );
}
