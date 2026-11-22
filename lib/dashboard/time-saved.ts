/** Time-saved estimate (Task 4). Clearly an estimate: fixed minutes per thing Drifty did. */
export const MINUTES = { changeList: 10, drift: 15, approval: 5 } as const;

export interface TimeSaved {
  changeLists: number;
  drifts: number;
  approvals: number;
  minutes: number;
}

export function timeSaved(counts: { changeLists: number; drifts: number; approvals: number }): TimeSaved {
  const minutes = counts.changeLists * MINUTES.changeList + counts.drifts * MINUTES.drift + counts.approvals * MINUTES.approval;
  return { ...counts, minutes };
}

/** "~1.5 hours" / "~20 min" */
export function formatSaved(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.round((minutes / 60) * 2) / 2;
  return `~${h} hour${h === 1 ? "" : "s"}`;
}
