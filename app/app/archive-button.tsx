"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/client-fetch";

/**
 * Archive / restore a project (owner/AM). Archived projects keep their rooms, history and
 * ledger; they just stop counting towards the plan's active clients.
 */
export function ArchiveButton({ projectId, archived, redirectTo }: { projectId: string; archived: boolean; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    if (!archived && !window.confirm("Archive this project? Its rooms, history and ledger stay; it just leaves your active list.")) return;
    setBusy(true);
    setError("");
    try {
      await apiJson(`/api/projects/${projectId}`, { method: "PATCH", body: { archived: !archived } });
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={run} disabled={busy}>
        {busy ? "Saving…" : archived ? "Restore" : "Archive"}
      </Button>
      {error && (
        <span className="max-w-64 text-right text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
