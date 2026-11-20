import "server-only";
import { hashInviteToken, inviteState, isWellFormedInviteToken, type InviteState } from "@/lib/auth/tokens";
import { getInviteByHash, getProject } from "@/lib/db/repo";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Invite, Project } from "@/lib/db/types";
import { signingSecret } from "@/lib/env";

export type ResolvedInvite =
  | { state: "ok"; invite: Invite; project: Project; agencyName: string }
  | { state: Exclude<InviteState, "ok"> | "invalid" };

/** Looks up an invite link token and says whether it can still be used. */
export async function resolveInvite(token: string): Promise<ResolvedInvite> {
  if (!isWellFormedInviteToken(token)) return { state: "invalid" };
  const invite = await getInviteByHash(hashInviteToken(signingSecret(), token));
  if (!invite) return { state: "invalid" };
  const state = inviteState(invite);
  if (state !== "ok") return { state };
  const project = await getProject(invite.project_id);
  if (!project || project.archived || !project.client_channel_id) return { state: "invalid" };
  const ws = await supabaseAdmin().from("workspaces").select("name").eq("id", project.workspace_id).maybeSingle();
  return { state: "ok", invite, project, agencyName: (ws.data as { name: string } | null)?.name ?? "Your agency" };
}
