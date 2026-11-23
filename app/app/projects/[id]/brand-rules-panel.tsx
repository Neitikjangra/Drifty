"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/client-fetch";

/**
 * The client's brand rules (team only) and how much of their taste Drifty has learned. Both
 * feed the pre-flight check before a draft goes to the client.
 */
export function BrandRulesPanel({ projectId, rules, memoryCount, canEdit }: { projectId: string; rules: string; memoryCount: number; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(rules);
  const [state, setState] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });

  async function save() {
    setState({ busy: true, error: "" });
    try {
      await apiJson(`/api/projects/${projectId}`, { method: "PATCH", body: { brandRules: text } });
      setEditing(false);
      setState({ busy: false, error: "" });
      router.refresh();
    } catch (err) {
      setState({ busy: false, error: err instanceof Error ? err.message : "Couldn't save." });
    }
  }

  return (
    <section className="space-y-2 rounded-2xl border p-3 bg-card" aria-label="Brand rules and client taste">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Brand rules &amp; taste</h2>
        {canEdit && !editing && (
          <button className="text-muted-foreground text-xs underline" onClick={() => setEditing(true)}>
            {rules ? "Edit" : "Add"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            aria-label="Brand rules"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
            rows={5}
            className="border-input bg-muted/60 focus-visible:ring-ring w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            placeholder={"Logo always top-left, at least 15% of the width\nBrand colours: deep green and cream only\nNever use the word 'cheap'\nPrices in ₹ with no decimals"}
          />
          {state.error && (
            <p className="text-xs text-red-400" role="alert">
              {state.error}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void save()} disabled={state.busy}>
              {state.busy ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setText(rules);
                setEditing(false);
              }}
              disabled={state.busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : rules ? (
        <p className="text-muted-foreground line-clamp-4 text-xs whitespace-pre-line">{rules}</p>
      ) : (
        <p className="text-muted-foreground text-xs">No brand rules yet. Add the client&apos;s logo, colour and wording rules so the pre-flight check can catch them.</p>
      )}
      <p className="text-muted-foreground text-xs">
        {memoryCount
          ? `Drifty remembers ${memoryCount} change request${memoryCount === 1 ? "" : "s"} from this client and checks new drafts against them.`
          : "Drifty learns this client's taste from every change they ask for."}{" "}
        Team only.
      </p>
    </section>
  );
}
