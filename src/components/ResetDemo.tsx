"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function ResetDemo() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function reset() {
    if (
      !window.confirm(
        "Start a fresh demo? All captures, debriefs, Work Maps and practice sessions move to data-archive/.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/demo/reset", { method: "POST" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      for (const key of Object.keys(localStorage))
        if (key.startsWith("apprentice-erp-")) localStorage.removeItem(key);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button disabled={busy} onClick={reset}>
        {busy ? "Resetting…" : "Reset demo"}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}
