"use client";
import { ConversationProvider } from "@elevenlabs/react";
import Studio from "./studio";
import type { Session } from "@/lib/types";
import type { Debrief } from "@/lib/workmap-types";
export default function DebriefPage(props: {
  session: Session;
  initial: Debrief | null;
  mapReady: boolean;
}) {
  return (
    <ConversationProvider>
      <Studio {...props} />
    </ConversationProvider>
  );
}
