/** Pure project-dashboard maths (FR-14). Unit-tested. */

export type DStatus = "draft" | "in_review" | "changes_requested" | "approved";

export interface DashDeliverable {
  id: string;
  title: string;
  status: DStatus;
  currentVersion: number;
  /** Versions the client has seen (posted to the client room). */
  sentVersions: number;
  openConflicts: number;
}

/** Change item statuses that still need work or a decision. */
export const OPEN_ITEM = new Set(["suggested", "confirmed", "missing", "reversed", "needs_check"]);

export type WaitingOn = "client" | "team" | "none";

/**
 * Who has the next move: the client when a version is in review or a conflict needs the
 * approver; the team when changes were requested or a new version is held for the drift check.
 */
export function waitingOn(d: Pick<DashDeliverable, "status" | "openConflicts">): WaitingOn {
  if (d.status === "approved") return "none";
  if (d.openConflicts > 0 || d.status === "in_review") return "client";
  return "team";
}

/** Revision rounds = versions the client saw after the first. */
export const roundsUsed = (d: Pick<DashDeliverable, "sentVersions">) => Math.max(0, d.sentVersions - 1);

export interface Dashboard {
  byStatus: Record<DStatus, number>;
  openItems: number;
  waiting: { client: number; team: number };
  roundsIncluded: number;
  rows: (DashDeliverable & { waitingOn: WaitingOn; rounds: number; overLimit: boolean; openItems: number })[];
  overLimit: number;
}

export function buildDashboard(
  deliverables: DashDeliverable[],
  items: { deliverableId: string; status: string }[],
  roundsIncluded: number,
): Dashboard {
  const byStatus: Record<DStatus, number> = { draft: 0, in_review: 0, changes_requested: 0, approved: 0 };
  const approved = new Set(deliverables.filter((d) => d.status === "approved").map((d) => d.id));
  const openBy = new Map<string, number>();
  for (const i of items) {
    if (!OPEN_ITEM.has(i.status) || approved.has(i.deliverableId)) continue; // approved work has nothing open
    openBy.set(i.deliverableId, (openBy.get(i.deliverableId) ?? 0) + 1);
  }
  const waiting = { client: 0, team: 0 };
  const rows = deliverables.map((d) => {
    byStatus[d.status]++;
    const w = waitingOn(d);
    if (w !== "none") waiting[w]++;
    const rounds = roundsUsed(d);
    return { ...d, waitingOn: w, rounds, overLimit: rounds > roundsIncluded, openItems: openBy.get(d.id) ?? 0 };
  });
  return {
    byStatus,
    openItems: [...openBy.values()].reduce((a, b) => a + b, 0),
    waiting,
    roundsIncluded,
    rows,
    overLimit: rows.filter((r) => r.overLimit).length,
  };
}
