"use client";
import { ConversationProvider } from "@elevenlabs/react";
import Capture from "./studio";
export default function Page() {
  return (
    <ConversationProvider>
      <Capture />
    </ConversationProvider>
  );
}
