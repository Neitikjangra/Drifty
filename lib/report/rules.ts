/**
 * Monthly client report (pure, unit-tested). Everything is computed from real project data for
 * one calendar month in India time; nothing is estimated except where labelled.
 */

const IST_MS = 5.5 * 60 * 60 * 1000;
export const istMonth = (iso: string) => new Date(new Date(iso).getTime() + IST_MS).toISOString().slice(0, 7);

export function parseMonth(v: string | null | undefined, now = new Date()): string {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : istMonth(now.toISOString());
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

export interface ReportInput {
  deliverables: { id: string; title: string; createdAt: string }[];
  /** Versions the client saw (posted to the client room). */
  sentVersions: { id: string; deliverableId: string; number: number; createdAt: string }[];
  approvals: { versionId: string; approvedAt: string }[];
  changeItems: { status: string; createdAt: string }[];
  alerts: { kind: string; createdAt: string; flagged: boolean }[];
}

export interface DeliverableLine {
  title: string;
  approvedVersion: number;
  rounds: number;
  daysToApproval: number;
  hoursClientTurnaround: number;
}

export interface MonthlyReport {
  month: string;
  approvals: number;
  deliverablesApproved: number;
  versionsShipped: number;
  changesCaptured: number;
  driftsCaught: number;
  avgRounds: number | null;
  avgDaysToApproval: number | null;
  avgHoursClientTurnaround: number | null;
  lines: DeliverableLine[];
}

const HOUR = 3_600_000;
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function buildMonthlyReport(month: string, input: ReportInput): MonthlyReport {
  const inMonth = (iso: string) => istMonth(iso) === month;
  const versionOf = new Map(input.sentVersions.map((v) => [v.id, v]));
  const approvalsInMonth = input.approvals.filter((a) => inMonth(a.approvedAt) && versionOf.has(a.versionId));

  const lines: DeliverableLine[] = [];
  for (const a of approvalsInMonth) {
    const v = versionOf.get(a.versionId)!;
    const d = input.deliverables.find((x) => x.id === v.deliverableId);
    if (!d) continue;
    const sentBefore = input.sentVersions.filter((x) => x.deliverableId === d.id && x.number <= v.number);
    lines.push({
      title: d.title,
      approvedVersion: v.number,
      rounds: Math.max(0, sentBefore.length - 1),
      daysToApproval: Math.round(((Date.parse(a.approvedAt) - Date.parse(d.createdAt)) / (24 * HOUR)) * 10) / 10,
      hoursClientTurnaround: Math.round(((Date.parse(a.approvedAt) - Date.parse(v.createdAt)) / HOUR) * 10) / 10,
    });
  }

  return {
    month,
    approvals: approvalsInMonth.length,
    deliverablesApproved: new Set(lines.map((l) => l.title)).size,
    versionsShipped: input.sentVersions.filter((v) => inMonth(v.createdAt)).length,
    changesCaptured: input.changeItems.filter((c) => inMonth(c.createdAt) && c.status !== "suggested" && c.status !== "rejected").length,
    driftsCaught: input.alerts.filter((a) => inMonth(a.createdAt) && a.flagged).length,
    avgRounds: avg(lines.map((l) => l.rounds)),
    avgDaysToApproval: avg(lines.map((l) => l.daysToApproval)),
    avgHoursClientTurnaround: avg(lines.map((l) => l.hoursClientTurnaround)),
    lines,
  };
}

/** "under 1 h", "5.5 h" under two days, otherwise "2.3 days". */
export function formatDuration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "under 1 h";
  return hours < 48 ? `${Math.round(hours * 10) / 10} h` : `${Math.round((hours / 24) * 10) / 10} days`;
}

/** The short summary an agency posts in the client room (markets Drifty in the footer). */
export function reportSummaryText(clientName: string, r: MonthlyReport): string {
  const lines = [
    `${monthLabel(r.month)} report for ${clientName}`,
    `• ${r.deliverablesApproved} deliverable${r.deliverablesApproved === 1 ? "" : "s"} approved (${r.approvals} approval${r.approvals === 1 ? "" : "s"} recorded)`,
    `• ${r.versionsShipped} version${r.versionsShipped === 1 ? "" : "s"} shared for review`,
  ];
  if (r.avgRounds !== null) lines.push(`• Average revision rounds: ${r.avgRounds}`);
  if (r.avgHoursClientTurnaround !== null) lines.push(`• Average time from version to approval: ${formatDuration(r.avgHoursClientTurnaround)}`);
  lines.push(`• ${r.changesCaptured} change${r.changesCaptured === 1 ? "" : "s"} captured from your feedback`);
  if (r.driftsCaught) lines.push(`• ${r.driftsCaught} conflict${r.driftsCaught === 1 ? "" : "s"} or missed change${r.driftsCaught === 1 ? "" : "s"} caught before delivery`);
  lines.push("", "Thank you for the quick feedback! Tracked with Drifty · drifty-six.vercel.app");
  return lines.join("\n");
}
