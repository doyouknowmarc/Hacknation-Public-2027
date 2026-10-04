import type { Metadata } from "next";
import StoryPlayer from "./player";
export const metadata: Metadata = { title: "Sensei · The story" };
export default function Story() {
  return <StoryPlayer />;
}
