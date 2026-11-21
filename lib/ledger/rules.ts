/** Pure ledger helpers (FR-13): filtering and CSV, shared by the page and the export. Unit-tested. */

export interface LedgerRow {
  approvalId: string;
  deliverableId: string;
  deliverable: string;
  version: number;
  versionId: string;
  approverId: string;
  approver: string;
  approvedAt: string; // ISO
  copy: string;
  assetSha256: string;
}

export interface LedgerFilter {
  deliverable?: string; // deliverable id
  approver?: string; // approver id
  from?: string; // YYYY-MM-DD, inclusive (India calendar day)
  to?: string; // YYYY-MM-DD, inclusive
  q?: string; // matches deliverable, approver or approved copy
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Calendar day in India time, so "approved on 21 Nov" matches what the agency saw. */
export function istDay(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
export function istTime(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().replace("T", " ").slice(0, 16);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function parseFilter(params: URLSearchParams | Record<string, string | undefined>): LedgerFilter {
  const get = (k: string) => (params instanceof URLSearchParams ? params.get(k) : params[k]) ?? undefined;
  const f: LedgerFilter = {};
  const d = get("deliverable");
  if (d && /^[0-9a-f-]{36}$/.test(d)) f.deliverable = d;
  const a = get("approver");
  if (a && a.length <= 64) f.approver = a;
  const from = get("from");
  if (from && DAY.test(from)) f.from = from;
  const to = get("to");
  if (to && DAY.test(to)) f.to = to;
  const q = get("q")?.trim();
  if (q) f.q = q.slice(0, 100);
  return f;
}

export function filterLedger(rows: LedgerRow[], f: LedgerFilter): LedgerRow[] {
  const q = f.q?.toLowerCase();
  return rows.filter((r) => {
    if (f.deliverable && r.deliverableId !== f.deliverable) return false;
    if (f.approver && r.approverId !== f.approver) return false;
    const day = istDay(r.approvedAt);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (q && ![r.deliverable, r.approver, r.copy].some((s) => s.toLowerCase().includes(q))) return false;
    return true;
  });
}

/** Query string for the CSV link, so the export matches what's on screen. */
export function filterQuery(f: LedgerFilter): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * One CSV cell: quoted, quotes doubled, and cells a spreadsheet would run as a formula
 * (= + - @ tab CR) get a leading apostrophe, so client copy can't execute in Excel/Sheets.
 */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export const CSV_HEADER = [
  "Deliverable",
  "Version",
  "Approver",
  "Approved at (IST)",
  "Approved at (UTC)",
  "Approved copy",
  "Asset SHA-256",
  "Version ID",
  "Approval ID",
];

/** CRLF + UTF-8 BOM so Excel opens Hindi text correctly. */
export function toCsv(rows: LedgerRow[]): string {
  const lines = [CSV_HEADER.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [r.deliverable, `v${r.version}`, r.approver, istTime(r.approvedAt), r.approvedAt, r.copy, r.assetSha256, r.versionId, r.approvalId]
        .map(csvCell)
        .join(","),
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvFileName(clientName: string, today: string): string {
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "project";
  return `drifty-ledger-${slug}-${today}.csv`;
}
