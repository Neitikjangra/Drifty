"use client";

import { useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filterLedger, filterQuery, istTime, type LedgerFilter, type LedgerRow } from "@/lib/ledger/rules";

const selectCls = "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";

/** Ledger table with filters (FR-13). The CSV link carries the same filters. */
export function LedgerTable({ projectId, rows }: { projectId: string; rows: LedgerRow[] }) {
  const [f, setF] = useState<LedgerFilter>({});
  const shown = useMemo(() => filterLedger(rows, f), [rows, f]);
  const deliverables = useMemo(() => [...new Map(rows.map((r) => [r.deliverableId, r.deliverable])).entries()], [rows]);
  const approvers = useMemo(() => [...new Map(rows.map((r) => [r.approverId, r.approver])).entries()], [rows]);
  const set = (k: keyof LedgerFilter, v: string) => setF((old) => ({ ...old, [k]: v || undefined }));
  const filtered = Object.values(f).some(Boolean);

  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
        No approvals yet. When the client&apos;s approver taps <span className="font-medium">Approve</span> on a card, it&apos;s recorded here.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 space-y-1 sm:col-span-3 lg:col-span-2">
          <Label htmlFor="l-q">Search</Label>
          <Input id="l-q" value={f.q ?? ""} onChange={(e) => set("q", e.target.value)} placeholder="Copy, deliverable or approver" maxLength={100} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="l-d">Deliverable</Label>
          <select id="l-d" className={selectCls} value={f.deliverable ?? ""} onChange={(e) => set("deliverable", e.target.value)}>
            <option value="">All</option>
            {deliverables.map(([id, t]) => (
              <option key={id} value={id}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="l-a">Approver</Label>
          <select id="l-a" className={selectCls} value={f.approver ?? ""} onChange={(e) => set("approver", e.target.value)}>
            <option value="">All</option>
            {approvers.map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="l-from">From</Label>
          <Input id="l-from" type="date" value={f.from ?? ""} onChange={(e) => set("from", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="l-to">To</Label>
          <Input id="l-to" type="date" value={f.to ?? ""} onChange={(e) => set("to", e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm" role="status">
          {shown.length} of {rows.length} approval{rows.length === 1 ? "" : "s"}
          {filtered && (
            <button className="ml-2 underline" onClick={() => setF({})}>
              Clear filters
            </button>
          )}
        </p>
        <a className={buttonVariants({ size: "sm" })} href={`/api/projects/${projectId}/ledger.csv${filterQuery(f)}`} download>
          Export CSV{filtered ? " (filtered)" : ""}
        </a>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border p-6 text-center text-sm">No approvals match these filters.</p>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="space-y-2 md:hidden">
            {shown.map((r) => (
              <li key={r.approvalId} className="space-y-1 rounded-lg border p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {r.deliverable} · v{r.version}
                  </span>
                  <a className="text-xs text-blue-700 underline" href={`/api/assets/${r.versionId}`} target="_blank" rel="noopener">
                    File
                  </a>
                </div>
                <p className="text-muted-foreground text-xs">
                  {r.approver} · {istTime(r.approvedAt)} IST
                </p>
                <p className="whitespace-pre-wrap">{r.copy || <span className="text-muted-foreground">(no copy)</span>}</p>
                <p className="text-muted-foreground font-mono text-[11px] break-all">SHA-256 {r.assetSha256}</p>
              </li>
            ))}
          </ul>
          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 font-medium">Deliverable</th>
                  <th className="p-2 font-medium">Version</th>
                  <th className="p-2 font-medium">Approver</th>
                  <th className="p-2 font-medium">Approved (IST)</th>
                  <th className="p-2 font-medium">Approved copy</th>
                  <th className="p-2 font-medium">File</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.approvalId} className="border-t align-top">
                    <td className="p-2 font-medium">{r.deliverable}</td>
                    <td className="p-2">v{r.version}</td>
                    <td className="p-2">{r.approver}</td>
                    <td className="p-2 whitespace-nowrap">{istTime(r.approvedAt)}</td>
                    <td className="max-w-md p-2 whitespace-pre-wrap">{r.copy || <span className="text-muted-foreground">(no copy)</span>}</td>
                    <td className="p-2">
                      <a className="text-blue-700 underline" href={`/api/assets/${r.versionId}`} target="_blank" rel="noopener">
                        Open
                      </a>
                      <div className="text-muted-foreground font-mono text-[10px]" title={r.assetSha256}>
                        {r.assetSha256.slice(0, 12)}…
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
