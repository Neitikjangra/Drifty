import "server-only";
import { hashInviteToken, inviteState, inviteTokenFor, isWellFormedInviteToken, type InviteState } from "@/lib/auth/tokens";
import { getInviteByHash, getInviteTokenHash, getProfile, getProject } from "@/lib/db/repo";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Invite, Project } from "@/lib/db/types";
import { appUrl, signingSecret } from "@/lib/env";

export type ResolvedInvite =
  | {
      state: "ok";
      invite: Invite;
      project: Project;
      agencyName: string;
      /** Set when this personal link was used before: the person it belongs to. */
      returningName: string | null;
    }
  | { state: Exclude<InviteState, "ok"> | "invalid" };

/** Looks up an invite link token and says whether it can still be used. Links are reusable. */
export async function resolveInvite(token: string): Promise<ResolvedInvite> {
  if (!isWellFormedInviteToken(token)) return { state: "invalid" };
  const invite = await getInviteByHash(hashInviteToken(signingSecret(), token));
  if (!invite) return { state: "invalid" };
  const state = inviteState(invite);
  if (state !== "ok") return { state };
  const project = await getProject(invite.project_id);
  if (!project || project.archived || !project.client_channel_id) return { state: "invalid" };
  const [ws, returning] = await Promise.all([
    supabaseAdmin().from("workspaces").select("name").eq("id", project.workspace_id).maybeSingle(),
    invite.used_by ? getProfile(invite.used_by) : Promise.resolve(null),
  ]);
  return {
    state: "ok",
    invite,
    project,
    agencyName: (ws.data as { name: string } | null)?.name ?? "Your agency",
    returningName: returning?.display_name ?? null,
  };
}

/** The shareable link for an invite, or null if it predates derived links (needs re-issue). */
export async function inviteLink(inviteId: string): Promise<string | null> {
  const { token, hash } = inviteTokenFor(signingSecret(), inviteId);
  const stored = await getInviteTokenHash(inviteId);
  return stored === hash ? `${appUrl()}/join/${token}` : null;
}
