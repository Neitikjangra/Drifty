/** Team invites and project teams (pure, unit-tested). */

export type TeamRole = "am" | "creative";
export const TEAM_ROLE_LABEL: Record<"owner" | TeamRole, string> = { owner: "Owner", am: "Account manager", creative: "Creative" };

/**
 * Dedicated job roles. Each maps to an access level, which is what the server checks:
 * "am" = every project, client and internal rooms, can invite clients;
 * "creative" = only the projects they're put on, internal room only.
 */
export const JOB_ROLES = [
  { id: "account_manager", label: "Account manager", access: "am", blurb: "Owns the client relationship" },
  { id: "project_manager", label: "Project manager", access: "am", blurb: "Runs timelines and approvals" },
  { id: "strategist", label: "Strategist", access: "am", blurb: "Plans campaigns with the client" },
  { id: "social_media_manager", label: "Social media manager", access: "am", blurb: "Posts and talks to the client" },
  { id: "designer", label: "Designer", access: "creative", blurb: "Makes and uploads the drafts" },
  { id: "copywriter", label: "Copywriter", access: "creative", blurb: "Writes captions and copy" },
  { id: "video_editor", label: "Video editor", access: "creative", blurb: "Cuts reels and videos" },
  { id: "photographer", label: "Photographer", access: "creative", blurb: "Shoots and edits photos" },
  { id: "developer", label: "Developer", access: "creative", blurb: "Builds sites and landing pages" },
  { id: "intern", label: "Intern", access: "creative", blurb: "Helps on assigned projects" },
] as const satisfies readonly { id: string; label: string; access: TeamRole; blurb: string }[];

export type JobRoleId = (typeof JOB_ROLES)[number]["id"];
export const JOB_ROLE_IDS = JOB_ROLES.map((r) => r.id) as [JobRoleId, ...JobRoleId[]];

export function jobRole(id: string | null | undefined) {
  return JOB_ROLES.find((r) => r.id === id) ?? null;
}

/** What to call a teammate: their job role, else their access level. */
export function roleLabel(access: "owner" | TeamRole, title?: string | null): string {
  if (access === "owner") return "Owner";
  return jobRole(title)?.label ?? TEAM_ROLE_LABEL[access];
}

/** Only the owner hands out manager-level access; managers can invite creatives. */
export function canGrant(granter: "owner" | TeamRole, access: TeamRole): boolean {
  if (granter === "owner") return true;
  return granter === "am" && access === "creative";
}

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
