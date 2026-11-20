import "server-only";
import type { MemberRole } from "@/lib/auth/permissions";
import { supabaseAdmin } from "./supabase-server";
import type { Invite, Membership, Profile, Project, ProjectGuest } from "./types";

/**
 * Server-side data access with the service role. RLS is bypassed here, so every
 * function that returns tenant data takes the caller's id and filters by it.
 */

export class DbError extends Error {
  constructor(op: string, code?: string) {
    super(`Database error in ${op}${code ? ` (${code})` : ""}`);
    this.name = "DbError";
  }
}

function check<T>(op: string, res: { data: T; error: { code?: string } | null }): T {
  if (res.error) throw new DbError(op, res.error.code);
  return res.data;
}

const PROJECT_COLS =
  "id, created_at, workspace_id, client_name, approver_id, rounds_included, client_channel_id, internal_channel_id, archived";

// ------------------------------------------------------------ profiles

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = supabaseAdmin();
  return check(
    "getProfile",
    await db.from("profiles").select("user_id, display_name, email, nexconn_user_id").eq("user_id", userId).maybeSingle(),
  );
}

export async function upsertProfile(p: Profile): Promise<void> {
  const db = supabaseAdmin();
  check("upsertProfile", await db.from("profiles").upsert(p, { onConflict: "user_id" }));
}

export async function getProfilesByNexconnIds(ids: string[]): Promise<Profile[]> {
  if (!ids.length) return [];
  const db = supabaseAdmin();
  return (
    check(
      "getProfilesByNexconnIds",
      await db.from("profiles").select("user_id, display_name, email, nexconn_user_id").in("nexconn_user_id", ids),
    ) ?? []
  );
}

// ------------------------------------------------------------ workspaces

export async function getMembership(userId: string): Promise<Membership | null> {
  const db = supabaseAdmin();
  const row = check(
    "getMembership",
    await db
      .from("members")
      .select("role, workspaces(id, name, owner_id, plan)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ) as { role: MemberRole; workspaces: Membership["workspace"] | null } | null;
  if (!row?.workspaces) return null;
  return { role: row.role, workspace: row.workspaces };
}

export async function createWorkspaceWithOwner(name: string, ownerId: string): Promise<string> {
  const db = supabaseAdmin();
  const ws = check(
    "createWorkspace",
    await db.from("workspaces").insert({ name, owner_id: ownerId }).select("id").single(),
  ) as { id: string };
  const res = await db.from("members").insert({ workspace_id: ws.id, user_id: ownerId, role: "owner" });
  if (res.error) {
    await db.from("workspaces").delete().eq("id", ws.id);
    throw new DbError("createOwnerMember", res.error.code);
  }
  return ws.id;
}

/** Nexconn ids of workspace members, optionally only some roles. */
export async function workspaceMemberNexconnIds(workspaceId: string, roles?: MemberRole[]): Promise<string[]> {
  const db = supabaseAdmin();
  let q = db.from("members").select("user_id, role").eq("workspace_id", workspaceId);
  if (roles) q = q.in("role", roles);
  const members = check("workspaceMembers", await q) as { user_id: string }[];
  if (!members.length) return [];
  const profiles = check(
    "workspaceMemberProfiles",
    await db.from("profiles").select("nexconn_user_id").in("user_id", members.map((m) => m.user_id)),
  ) as { nexconn_user_id: string }[];
  return profiles.map((p) => p.nexconn_user_id);
}

/** Who is in a room, as Nexconn ids + names. Client room: owner/AM + guests. Internal: all members. */
export async function roomMembers(
  projectId: string,
  workspaceId: string,
  clientRoom: boolean,
): Promise<{ userId: string; name: string }[]> {
  const db = supabaseAdmin();
  let mq = db.from("members").select("user_id").eq("workspace_id", workspaceId);
  if (clientRoom) mq = mq.in("role", ["owner", "am"]);
  const memberIds = (check("roomMembers.members", await mq) as { user_id: string }[]).map((m) => m.user_id);
  const guestIds = clientRoom
    ? (
        check(
          "roomMembers.guests",
          await db.from("project_guests").select("user_id").eq("project_id", projectId),
        ) as { user_id: string }[]
      ).map((g) => g.user_id)
    : [];
  const ids = [...memberIds, ...guestIds];
  if (!ids.length) return [];
  const profiles = check(
    "roomMembers.profiles",
    await db.from("profiles").select("nexconn_user_id, display_name").in("user_id", ids),
  ) as { nexconn_user_id: string; display_name: string }[];
  return profiles.map((p) => ({ userId: p.nexconn_user_id, name: p.display_name }));
}

// ------------------------------------------------------------ projects

export async function listProjects(workspaceId: string): Promise<Project[]> {
  const db = supabaseAdmin();
  return check(
    "listProjects",
    await db
      .from("projects")
      .select(PROJECT_COLS)
      .eq("workspace_id", workspaceId)
      .eq("archived", false)
      .order("created_at", { ascending: false }),
  ) as Project[];
}

export async function getProject(projectId: string): Promise<Project | null> {
  const db = supabaseAdmin();
  return check(
    "getProject",
    await db.from("projects").select(PROJECT_COLS).eq("id", projectId).maybeSingle(),
  ) as Project | null;
}

export async function insertProject(workspaceId: string, clientName: string): Promise<Project> {
  const db = supabaseAdmin();
  return check(
    "insertProject",
    await db.from("projects").insert({ workspace_id: workspaceId, client_name: clientName }).select(PROJECT_COLS).single(),
  ) as Project;
}

export async function setProjectChannels(projectId: string, clientChannelId: string, internalChannelId: string) {
  const db = supabaseAdmin();
  check(
    "setProjectChannels",
    await db
      .from("projects")
      .update({ client_channel_id: clientChannelId, internal_channel_id: internalChannelId })
      .eq("id", projectId),
  );
}

export async function deleteProject(projectId: string) {
  const db = supabaseAdmin();
  check("deleteProject", await db.from("projects").delete().eq("id", projectId));
}

/** Projects (in any workspace the user belongs to) that own any of these channel ids. */
export async function projectsByChannelIds(channelIds: string[]): Promise<Project[]> {
  if (!channelIds.length) return [];
  const db = supabaseAdmin();
  const list = channelIds.join(",");
  return check(
    "projectsByChannelIds",
    await db
      .from("projects")
      .select(PROJECT_COLS)
      .or(`client_channel_id.in.(${list}),internal_channel_id.in.(${list})`),
  ) as Project[];
}

// ------------------------------------------------------------ guests

export async function listGuests(projectId: string): Promise<ProjectGuest[]> {
  const db = supabaseAdmin();
  const rows = check(
    "listGuests",
    await db
      .from("project_guests")
      .select("user_id, role, created_at, profiles(display_name)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ) as unknown as { user_id: string; role: ProjectGuest["role"]; created_at: string; profiles: { display_name: string } | null }[];
  return rows.map((r) => ({
    user_id: r.user_id,
    role: r.role,
    display_name: r.profiles?.display_name ?? "Guest",
    joined_at: r.created_at,
  }));
}

export async function getGuestRole(projectId: string, guestId: string): Promise<ProjectGuest["role"] | null> {
  const db = supabaseAdmin();
  const row = check(
    "getGuestRole",
    await db.from("project_guests").select("role").eq("project_id", projectId).eq("user_id", guestId).maybeSingle(),
  ) as { role: ProjectGuest["role"] } | null;
  return row?.role ?? null;
}

export async function guestProjectIds(guestId: string): Promise<string[]> {
  const db = supabaseAdmin();
  const rows = check(
    "guestProjectIds",
    await db.from("project_guests").select("project_id").eq("user_id", guestId),
  ) as { project_id: string }[];
  return rows.map((r) => r.project_id);
}

/**
 * Adds a guest. If they are the approver, the previous approver becomes a reviewer
 * and projects.approver_id is updated.
 */
export async function addGuest(projectId: string, guestId: string, role: ProjectGuest["role"]) {
  const db = supabaseAdmin();
  if (role === "approver") await demoteApprover(projectId);
  check(
    "addGuest",
    await db.from("project_guests").upsert({ project_id: projectId, user_id: guestId, role }, { onConflict: "project_id,user_id" }),
  );
  if (role === "approver") {
    check("setApproverId", await db.from("projects").update({ approver_id: guestId }).eq("id", projectId));
  }
}

async function demoteApprover(projectId: string) {
  const db = supabaseAdmin();
  check(
    "demoteApprover",
    await db.from("project_guests").update({ role: "reviewer" }).eq("project_id", projectId).eq("role", "approver"),
  );
}

export async function setApprover(projectId: string, guestId: string) {
  const db = supabaseAdmin();
  await demoteApprover(projectId);
  check(
    "promoteApprover",
    await db.from("project_guests").update({ role: "approver" }).eq("project_id", projectId).eq("user_id", guestId),
  );
  check("setApproverId", await db.from("projects").update({ approver_id: guestId }).eq("id", projectId));
}

// ------------------------------------------------------------ invites

export async function insertInvite(row: {
  project_id: string;
  email_or_phone: string;
  display_name: string | null;
  role: Invite["role"];
  token_hash: string;
  expires_at: string;
  created_by: string;
}): Promise<Invite> {
  const db = supabaseAdmin();
  return check(
    "insertInvite",
    await db
      .from("invites")
      .insert(row)
      .select("id, created_at, project_id, email_or_phone, display_name, role, expires_at, revoked_at, used_at")
      .single(),
  ) as Invite;
}

export async function listInvites(projectId: string): Promise<Invite[]> {
  const db = supabaseAdmin();
  return check(
    "listInvites",
    await db
      .from("invites")
      .select("id, created_at, project_id, email_or_phone, display_name, role, expires_at, revoked_at, used_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ) as Invite[];
}

export async function getInviteByHash(hash: string): Promise<Invite | null> {
  const db = supabaseAdmin();
  return check(
    "getInviteByHash",
    await db
      .from("invites")
      .select("id, created_at, project_id, email_or_phone, display_name, role, expires_at, revoked_at, used_at")
      .eq("token_hash", hash)
      .maybeSingle(),
  ) as Invite | null;
}

export async function getInvite(inviteId: string): Promise<Invite | null> {
  const db = supabaseAdmin();
  return check(
    "getInvite",
    await db
      .from("invites")
      .select("id, created_at, project_id, email_or_phone, display_name, role, expires_at, revoked_at, used_at")
      .eq("id", inviteId)
      .maybeSingle(),
  ) as Invite | null;
}

/** Undo a claim when joining failed part-way. */
export async function releaseInvite(inviteId: string) {
  const db = supabaseAdmin();
  check("releaseInvite", await db.from("invites").update({ used_at: null, used_by: null }).eq("id", inviteId));
}

/** Records who used an invite (after their profile exists; used_by references profiles). */
export async function setInviteUsedBy(inviteId: string, guestId: string) {
  const db = supabaseAdmin();
  check("setInviteUsedBy", await db.from("invites").update({ used_by: guestId }).eq("id", inviteId));
}

/** Marks the invite used only if still unused (single use, race-safe). Returns false if someone beat us. */
export async function claimInvite(inviteId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const rows = check(
    "claimInvite",
    await db
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", inviteId)
      .is("used_at", null)
      .is("revoked_at", null)
      .select("id"),
  ) as { id: string }[];
  return rows.length === 1;
}

export async function revokeInvite(inviteId: string) {
  const db = supabaseAdmin();
  check(
    "revokeInvite",
    await db.from("invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId).is("used_at", null),
  );
}
