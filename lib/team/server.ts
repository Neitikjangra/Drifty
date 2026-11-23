import "server-only";
import { hashInviteToken, isWellFormedInviteToken, newInviteToken } from "@/lib/auth/tokens";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Project } from "@/lib/db/types";
import { signingSecret } from "@/lib/env";
import { addToRoom, removeFromRoom } from "@/lib/nexconn/rooms";
import { teamDiff, teamInviteState, teamTokenText, type TeamInviteState, type TeamRole } from "./rules";

const fail = (op: string, code?: string) => new Error(`${op} ${code ?? ""}`.trim());
const teamHash = (token: string) => hashInviteToken(signingSecret(), teamTokenText(token));

export interface TeamMember {
  userId: string;
  role: "owner" | TeamRole;
  /** Job role id (designer, copywriter...), '' when none was picked. */
  title: string;
  name: string;
  email: string | null;
  nexconnId: string | null;
}

export async function listTeam(workspaceId: string): Promise<TeamMember[]> {
  const db = supabaseAdmin();
  const { data: members, error } = await db.from("members").select("user_id, role, title, created_at").eq("workspace_id", workspaceId).order("created_at");
  if (error) throw fail("listTeam", error.code);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (!ids.length) return [];
  const { data: profiles } = await db.from("profiles").select("user_id, display_name, email, nexconn_user_id").in("user_id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.user_id as string, p as { display_name: string; email: string | null; nexconn_user_id: string }]));
  return (members ?? []).map((m) => {
    const p = byId.get(m.user_id as string);
    return { userId: m.user_id as string, role: m.role as TeamMember["role"], title: (m.title as string) ?? "", name: p?.display_name ?? "Teammate", email: p?.email ?? null, nexconnId: p?.nexconn_user_id ?? null };
  });
}

/** user ids on a project's team (creatives assigned to it). */
export async function projectTeamIds(projectId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin().from("project_members").select("user_id").eq("project_id", projectId);
  if (error) throw fail("projectTeamIds", error.code);
  return (data ?? []).map((r) => r.user_id as string);
}

export async function isOnProject(projectId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("project_members").select("user_id").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export async function projectIdsFor(userId: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin().from("project_members").select("project_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.project_id as string));
}

/**
 * Sets which teammates (creatives) work on a project and syncs its internal room. Owners and
 * account managers are always in both rooms, so they're ignored here.
 */
export async function setProjectTeam(project: Project, wantedUserIds: string[]): Promise<void> {
  const team = await listTeam(project.workspace_id);
  const creatives = new Map(team.filter((m) => m.role === "creative").map((m) => [m.userId, m]));
  const wanted = wantedUserIds.filter((id) => creatives.has(id));
  const { add, remove } = teamDiff(await projectTeamIds(project.id), wanted);
  const db = supabaseAdmin();
  if (add.length) {
    const { error } = await db.from("project_members").upsert(add.map((user_id) => ({ project_id: project.id, user_id })), { onConflict: "project_id,user_id" });
    if (error) throw fail("setProjectTeam.add", error.code);
  }
  if (remove.length) {
    const { error } = await db.from("project_members").delete().eq("project_id", project.id).in("user_id", remove);
    if (error) throw fail("setProjectTeam.remove", error.code);
  }
  const nx = (ids: string[]) => ids.map((id) => creatives.get(id)?.nexconnId).filter((x): x is string => Boolean(x));
  if (project.internal_channel_id) {
    await addToRoom(project.internal_channel_id, nx(add)).catch(() => console.warn("[team] room join failed"));
    await removeFromRoom(project.internal_channel_id, nx(remove)).catch(() => console.warn("[team] room leave failed"));
  }
}

// ------------------------------------------------------------ team invites

export interface TeamInviteRow {
  id: string;
  role: TeamRole;
  title: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

export async function createTeamInvite(workspaceId: string, role: TeamRole, title: string, createdBy: string): Promise<{ id: string; token: string }> {
  const { token } = newInviteToken(signingSecret());
  const { data, error } = await supabaseAdmin()
    .from("team_invites")
    .insert({ workspace_id: workspaceId, role, title, token_hash: teamHash(token), created_by: createdBy })
    .select("id")
    .single();
  if (error || !data) throw fail("createTeamInvite", error?.code);
  return { id: data.id as string, token };
}

export async function listTeamInvites(workspaceId: string): Promise<TeamInviteRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("team_invites")
    .select("id, role, title, created_at, expires_at, used_at, revoked_at")
    .eq("workspace_id", workspaceId)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw fail("listTeamInvites", error.code);
  return (data ?? []) as TeamInviteRow[];
}

export async function revokeTeamInvite(workspaceId: string, id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("team_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("used_at", null)
    .select("id");
  if (error) throw fail("revokeTeamInvite", error.code);
  return Boolean(data?.length);
}

export type ResolvedTeamInvite =
  | { state: "ok"; id: string; role: TeamRole; title: string; workspaceId: string; workspaceName: string }
  | { state: Exclude<TeamInviteState, "ok"> | "invalid" };

export async function resolveTeamInvite(token: string): Promise<ResolvedTeamInvite> {
  if (!isWellFormedInviteToken(token)) return { state: "invalid" };
  const { data } = await supabaseAdmin()
    .from("team_invites")
    .select("id, role, title, workspace_id, expires_at, used_at, revoked_at, workspaces(name)")
    .eq("token_hash", teamHash(token))
    .maybeSingle();
  if (!data) return { state: "invalid" };
  const row = data as unknown as TeamInviteRow & { workspace_id: string; workspaces: { name: string } | null };
  const state = teamInviteState(row);
  if (state !== "ok") return { state };
  return { state: "ok", id: row.id, role: row.role, title: row.title ?? "", workspaceId: row.workspace_id, workspaceName: row.workspaces?.name ?? "your agency" };
}

/** Claims the link once (atomic); false when someone else used it first. */
export async function claimTeamInvite(id: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("team_invites")
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq("id", id)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw fail("claimTeamInvite", error.code);
  return Boolean(data?.length);
}

/** New account manager: joins every project's client and internal room. */
export async function addManagerToRooms(workspaceId: string, nexconnId: string): Promise<void> {
  const { data } = await supabaseAdmin().from("projects").select("client_channel_id, internal_channel_id").eq("workspace_id", workspaceId);
  for (const p of (data ?? []) as { client_channel_id: string | null; internal_channel_id: string | null }[]) {
    for (const ch of [p.client_channel_id, p.internal_channel_id]) {
      if (ch) await addToRoom(ch, [nexconnId]).catch(() => console.warn("[team] room join failed"));
    }
  }
}

/** Removes a teammate (never the owner) from the workspace, its project teams and all rooms. */
export async function removeTeammate(workspaceId: string, member: TeamMember): Promise<void> {
  const db = supabaseAdmin();
  const { data: projects } = await db.from("projects").select("id, client_channel_id, internal_channel_id").eq("workspace_id", workspaceId);
  const list = (projects ?? []) as { id: string; client_channel_id: string | null; internal_channel_id: string | null }[];
  if (list.length) await db.from("project_members").delete().eq("user_id", member.userId).in("project_id", list.map((p) => p.id));
  const { error } = await db.from("members").delete().eq("workspace_id", workspaceId).eq("user_id", member.userId).neq("role", "owner");
  if (error) throw fail("removeTeammate", error.code);
  if (member.nexconnId) {
    for (const p of list) {
      for (const ch of [p.client_channel_id, p.internal_channel_id]) {
        if (ch) await removeFromRoom(ch, [member.nexconnId]).catch(() => {});
      }
    }
  }
}

/**
 * Changes a teammate's job role (and with it their access level), keeping rooms in step:
 * becoming a manager joins every project's rooms; becoming a creative leaves client rooms and
 * the internal rooms of projects they aren't on.
 */
export async function changeTeammateRole(workspaceId: string, member: TeamMember, access: TeamRole, title: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("members").update({ role: access, title }).eq("workspace_id", workspaceId).eq("user_id", member.userId).neq("role", "owner");
  if (error) throw fail("changeTeammateRole", error.code);
  if (access === member.role || !member.nexconnId) return;
  if (access === "am") {
    await addManagerToRooms(workspaceId, member.nexconnId);
    return;
  }
  const [{ data: projects }, onProjects] = await Promise.all([
    db.from("projects").select("id, client_channel_id, internal_channel_id").eq("workspace_id", workspaceId),
    projectIdsFor(member.userId),
  ]);
  for (const p of (projects ?? []) as { id: string; client_channel_id: string | null; internal_channel_id: string | null }[]) {
    if (p.client_channel_id) await removeFromRoom(p.client_channel_id, [member.nexconnId]).catch(() => {});
    if (p.internal_channel_id && !onProjects.has(p.id)) await removeFromRoom(p.internal_channel_id, [member.nexconnId]).catch(() => {});
  }
}
