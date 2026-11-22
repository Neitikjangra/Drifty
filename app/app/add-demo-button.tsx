"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/client-fetch";

export function AddDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setBusy(true);
    setError("");
    try {
      const { projectId } = await apiJson<{ projectId: string }>("/api/demo");
      router.push(`/app/projects/${projectId}?demo=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the demo.");
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <Button size="sm" variant="outline" onClick={run} disabled={busy}>
        {busy ? "Setting up the demo…" : "Try the demo project"}
      </Button>
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
