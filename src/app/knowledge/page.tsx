import type { Metadata } from "next";
import KnowledgeView from "./view";
export const metadata: Metadata = {
  title: "Sensei · Knowledge dimensions",
  description: "The seven dimensions Sensei uses to capture an expert decision.",
};
export default function Page() {
  return <KnowledgeView />;
}
