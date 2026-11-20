import "server-only";
import type { GuestRole, MemberRole } from "@/lib/auth/permissions";
import { getAgencyUser, getGuestId } from "@/lib/auth/session";
import { getGuestRole, getMembership, getProfile, getProject } from "@/lib/db/repo";
import type { Membership, Profile, Project } from "@/lib/db/types";

/** Who is calling, resolved and verified on the server. */
export type Caller =
  | { kind: "member"; userId: string; email: string | null; membership: Membership | null; profile: Profile | null }
  | { kind: "guest"; userId: string; profile: Profile | null }
  | { kind: "anonymous" };

export async function getCaller(): Promise<Caller> {
  const user = await getAgencyUser();
  if (user) {
    const [membership, profile] = await Promise.all([getMembership(user.id), getProfile(user.id)]);
    return { kind: "member", userId: user.id, email: user.email, membership, profile };
  }
  const guestId = await getGuestId();
  if (guestId) return { kind: "guest", userId: guestId, profile: await getProfile(guestId) };
  return { kind: "anonymous" };
}

/**
 * For routes: resolves access, distinguishing "not signed in" (401) from
 * "no access / doesn't exist" (404, so project ids aren't confirmed to strangers).
 */
export async function routeProjectAccess(
  projectId: string,
): Promise<{ ok: true; access: ProjectAccess } | { ok: false; status: 401 | 404 }> {
  const caller = await getCaller();
  if (caller.kind === "anonymous") return { ok: false, status: 401 };
  const access = await projectAccess(projectId, caller);
  return access ? { ok: true, access } : { ok: false, status: 404 };
}

export type ProjectAccess =
  | { kind: "member"; project: Project; role: MemberRole; userId: string; profile: Profile | null }
  | { kind: "guest"; project: Project; role: GuestRole; userId: string; profile: Profile | null };

/**
 * The caller's access to one project, or null. Agency members must belong to the
 * project's workspace; guests must be in project_guests for this project.
 */
export async function projectAccess(projectId: string, caller?: Caller): Promise<ProjectAccess | null> {
  if (!/^[0-9a-f-]{36}$/.test(projectId)) return null;
  const c = caller ?? (await getCaller());
  if (c.kind === "anonymous") return null;
  const project = await getProject(projectId);
  if (!project || project.archived) return null;

  if (c.kind === "member") {
    if (!c.membership || c.membership.workspace.id !== project.workspace_id) return null;
    return { kind: "member", project, role: c.membership.role, userId: c.userId, profile: c.profile };
  }
  const role = await getGuestRole(project.id, c.userId);
  if (!role) return null;
  return { kind: "guest", project, role, userId: c.userId, profile: c.profile };
}
