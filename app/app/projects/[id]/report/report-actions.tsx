"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/client-fetch";

/** Save as PDF (the browser's print dialog) and share the summary in the client room. */
export function ReportActions({ projectId, month, canShare, hasData }: { projectId: string; month: string; canShare: boolean; hasData: boolean }) {
  const [state, setState] = useState<{ busy: boolean; text: string; error: boolean }>({ busy: false, text: "", error: false });
  async function share() {
    if (!window.confirm("Post this month's summary in the client room, as your message?")) return;
    setState({ busy: true, text: "", error: false });
    try {
      await apiJson(`/api/projects/${projectId}/report/share`, { body: { month } });
      setState({ busy: false, text: "Shared in the client room.", error: false });
    } catch (err) {
      setState({ busy: false, text: err instanceof Error ? err.message : "Couldn't share the report.", error: true });
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button variant="outline" onClick={() => window.print()} disabled={!hasData}>
        Save as PDF
      </Button>
      {canShare && (
        <Button onClick={() => void share()} disabled={state.busy || !hasData}>
          {state.busy ? "Sharing…" : "Share in client room"}
        </Button>
      )}
      {state.text && (
        <span className={`text-sm ${state.error ? "text-red-600" : "text-green-800"}`} role="status">
          {state.text}
        </span>
      )}
    </div>
  );
}
