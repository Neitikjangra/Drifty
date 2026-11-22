/** Pricing rules (PRD section 5, Round 5): Free = 2 active client projects; Pilot = by arrangement. */
export const FREE_ACTIVE_CLIENTS = 2;

export function clientLimit(plan: string): number | null {
  return plan === "free" ? FREE_ACTIVE_CLIENTS : null; // null = no limit
}

/** Whether one more active client project fits the plan. Demo projects never count. */
export function canAddClient(plan: string, activeClients: number): boolean {
  const limit = clientLimit(plan);
  return limit === null || activeClients < limit;
}

export const PLAN_LIMIT_MESSAGE =
  "The Free plan includes 2 active clients. Archive a finished project, or contact us about the Pilot plan.";
