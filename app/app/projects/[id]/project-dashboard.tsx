"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiJson } from "@/lib/client-fetch";
import type { Dashboard } from "@/lib/dashboard/rules";

const WAIT: Record<string, string> = { client: "Client", team: "Team", none: "Done" };

/** Project dashboard (FR-14): status counts, open changes, who's waiting, rounds used. */
export function ProjectDashboard({ projectId, data, canManage }: { projectId: string; data: Dashboard; canManage: boolean }) {
  const { byStatus: s } = data;
  const totalRounds = data.rows.reduce((a, r) => a + r.rounds, 0);
  return (
    <section className="space-y-3 rounded-lg border p-3" aria-label="Project dashboard">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Deliverables" value={data.rows.length}>
          {data.rows.length ? (
            <span>
              {[s.in_review && `${s.in_review} in review`, s.changes_requested && `${s.changes_requested} changes`, s.draft && `${s.draft} held`, s.approved && `${s.approved} approved`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : (
            <span>None yet</span>
          )}
        </Tile>
        <Tile label="Open changes" value={data.openItems}>
          <span>Suggested, confirmed or flagged</span>
        </Tile>
        <Tile label="Waiting on" value={`${data.waiting.client} · ${data.waiting.team}`}>
          <span>client · team</span>
        </Tile>
        <Tile label="Rounds used" value={totalRounds} tone={data.overLimit ? "warn" : undefined}>
          <RoundsIncluded projectId={projectId} value={data.roundsIncluded} canManage={canManage} overLimit={data.overLimit} />
        </Tile>
      </div>
      {data.rows.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer text-xs">By deliverable</summary>
          <ul className="mt-2 divide-y">
            {data.rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">
                  {r.title} <span className="text-muted-foreground">v{r.currentVersion}</span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {r.openItems ? `${r.openItems} open · ` : ""}
                  <span className={r.overLimit ? "font-medium text-amber-800" : ""}>
                    {r.rounds}/{data.roundsIncluded} rounds
                  </span>{" "}
                  · waiting: {WAIT[r.waitingOn]}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex justify-end">
        <Link href={`/app/projects/${projectId}/ledger`} className={buttonVariants({ size: "sm", variant: "outline" })}>
          Approval ledger →
        </Link>
      </div>
    </section>
  );
}

function Tile({ label, value, tone, children }: { label: string; value: number | string; tone?: "warn"; children: React.ReactNode }) {
  return (
    <div className={`rounded-md p-2 ${tone === "warn" ? "bg-amber-50" : "bg-muted/40"}`}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <div className="text-muted-foreground text-xs">{children}</div>
    </div>
  );
}

function RoundsIncluded({ projectId, value, canManage, overLimit }: { projectId: string; value: number; canManage: boolean; overLimit: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [n, setN] = useState(String(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const note = overLimit ? `${overLimit} over the ${value} included` : `${value} included per deliverable`;
  if (!editing) {
    return (
      <span>
        {note}
        {canManage && (
          <button className="ml-1 underline" onClick={() => setEditing(true)}>
            Change
          </button>
        )}
      </span>
    );
  }
  async function save() {
    const v = Number(n);
    if (!Number.isInteger(v) || v < 1 || v > 20) return setError("1 to 20");
    setBusy(true);
    setError("");
    try {
      await apiJson(`/api/projects/${projectId}`, { method: "PATCH", body: { roundsIncluded: v } });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      <input
        aria-label="Rounds included per deliverable"
        type="number"
        min={1}
        max={20}
        value={n}
        onChange={(e) => setN(e.target.value)}
        className="border-input bg-background h-7 w-14 rounded border px-1 text-sm"
      />
      <Button size="sm" className="h-7 px-2" onClick={save} disabled={busy}>
        {busy ? "…" : "Save"}
      </Button>
      {error && <span className="text-red-600">{error}</span>}
    </span>
  );
}
