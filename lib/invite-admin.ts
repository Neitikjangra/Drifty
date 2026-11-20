import "server-only";
import { randomUUID } from "node:crypto";
import { getCaller, projectAccess, type ProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { INVITE_TTL_MS, inviteTokenFor } from "@/lib/auth/tokens";
import { getInvite, insertInvite } from "@/lib/db/repo";
import type { Invite } from "@/lib/db/types";
import { appUrl, signingSecret } from "@/lib/env";

/**
 * Loads an invite and checks the caller can manage its project (owner/AM).
 * 401 if signed out; 404 if missing or not theirs (ids aren't confirmed to strangers).
 */
export async function manageableInvite(
  inviteId: string,
): Promise<{ ok: true; invite: Invite; access: ProjectAccess & { kind: "member" } } | { ok: false; status: 401 | 403 | 404 }> {
  if (!/^[0-9a-f-]{36}$/.test(inviteId)) return { ok: false, status: 404 };
  const caller = await getCaller();
  if (caller.kind === "anonymous") return { ok: false, status: 401 };
  const invite = await getInvite(inviteId);
  if (!invite) return { ok: false, status: 404 };
  const access = await projectAccess(invite.project_id, caller);
  if (!access || access.kind !== "member") return { ok: false, status: 404 };
  if (!canManageProjects(access.role)) return { ok: false, status: 403 };
  return { ok: true, invite, access };
}

/** Creates a personal invite link (30 days). Optionally bound to an existing guest (re-issue). */
export async function createInvite(input: {
  projectId: string;
  emailOrPhone: string;
  name: string | null;
  role: Invite["role"];
  createdBy: string;
  usedBy?: string | null;
}): Promise<{ invite: Invite; link: string }> {
  const id = randomUUID();
  const { token, hash } = inviteTokenFor(signingSecret(), id);
  const invite = await insertInvite({
    id,
    project_id: input.projectId,
    email_or_phone: input.emailOrPhone,
    display_name: input.name,
    role: input.role,
    token_hash: hash,
    expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    created_by: input.createdBy,
    used_by: input.usedBy ?? null,
  });
  return { invite, link: `${appUrl()}/join/${token}` };
}
