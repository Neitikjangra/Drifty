"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/client-fetch";

export interface SummarisableDeliverable {
  id: string;
  title: string;
  version: number;
}

/** "Summarise feedback" shortcut shown above the Internal room for deliverables awaiting changes. */
export function InternalSummariseBar({ projectId, clientChannelId, items }: { projectId: string; clientChannelId: string | null; items: SummarisableDeliverable[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; tone: "ok" | "info" | "error" } | null>(null);
  if (!items.length) return null;

  async function run(d: SummarisableDeliverable) {
    setBusy(d.id);
    setNote(null);
    try {
      if (clientChannelId) {
        const { readRoomHistory } = await import("./chat-host");
        const history = (await readRoomHistory(clientChannelId, 200)).filter(
          (m) => ["RC:TxtMsg", "RC:ReferenceMsg", "RC:HQVCMsg", "RC:VcMsg"].includes(m.messageType) && m.senderUserId !== "driftybot",
        );
        if (history.length) await apiJson("/api/messages/sync", { body: { projectId, messages: history } }).catch(() => {});
      }
      const r = await apiJson<{ items: number }>(`/api/deliverables/${d.id}/summarise`);
      setNote({ tone: "ok", text: `${r.items} change${r.items === 1 ? "" : "s"} suggested for ${d.title} v${d.version}. The change list is below.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't summarise, try again.";
      setNote({ tone: /No client feedback/.test(msg) ? "info" : "error", text: /No client feedback/.test(msg) ? `No new client feedback since ${d.title} v${d.version}.` : msg });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-secondary flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm">
      <span className="font-medium">Summarise client feedback:</span>
      {items.map((d) => (
        <Button key={d.id} size="sm" onClick={() => void run(d)} disabled={busy !== null}>
          {busy === d.id ? "Summarising…" : `${d.title} v${d.version}`}
        </Button>
      ))}
      {note && (
        <span className={`w-full text-xs ${note.tone === "error" ? "text-red-400" : note.tone === "info" ? "text-air-force-blue-300" : "text-ash-grey-200"}`} role="status">
          {note.text}
        </span>
      )}
    </div>
  );
}
