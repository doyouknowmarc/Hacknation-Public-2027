import { Suspense } from "react";
import ERP from "./sandbox";
export default function Page() {
  return (
    <Suspense fallback={<main>Loading sandbox…</main>}>
      <ERP />
    </Suspense>
  );
}
