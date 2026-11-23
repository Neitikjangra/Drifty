/** Team invites and project teams (pure, unit-tested). */

export type TeamRole = "am" | "creative";
export const TEAM_ROLE_LABEL: Record<"owner" | TeamRole, string> = { owner: "Owner", am: "Account manager", creative: "Creative" };

export type TeamInviteState = "ok" | "expired" | "revoked" | "used";

/** Team links work once (they create a workspace membership), until revoked or 7 days old. */
export function teamInviteState(
  inv: { expires_at: string; revoked_at: string | null; used_at: string | null },
  now: number = Date.now(),
): TeamInviteState {
  if (inv.revoked_at) return "revoked";
  if (inv.used_at) return "used";
  if (new Date(inv.expires_at).getTime() <= now) return "expired";
  return "ok";
}

export const TEAM_INVITE_MESSAGES: Record<Exclude<TeamInviteState, "ok">, string> = {
  expired: "This team link has expired. Ask for a new one.",
  revoked: "This team link was cancelled. Ask for a new one.",
  used: "This team link was already used. Ask for a new one.",
};

/** Creatives only see projects they're on; owners and account managers see all. */
export function seesAllProjects(role: "owner" | TeamRole): boolean {
  return role !== "creative";
}

/** Who to add to / remove from a project's internal room when its team changes. */
export function teamDiff(current: string[], wanted: string[]): { add: string[]; remove: string[] } {
  const c = new Set(current);
  const w = new Set(wanted);
  return { add: [...w].filter((x) => !c.has(x)), remove: [...c].filter((x) => !w.has(x)) };
}

/** Domain-separated token text, so a client-invite token can never act as a team token. */
export const teamTokenText = (token: string) => `team:${token}`;
