import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { INVITE_TTL_MS, newInviteToken } from "@/lib/auth/tokens";
import { insertInvite } from "@/lib/db/repo";
import { appUrl, signingSecret } from "@/lib/env";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";

const body = z.object({
  projectId: z.uuid(),
  emailOrPhone: z.string().trim().min(3).max(120),
  name: z.string().trim().min(1).max(64),
  role: z.enum(["approver", "reviewer"]),
});

/**
 * POST /api/invites: creates a single-use client invite link (FR-3), valid 7 days.
 * The raw token is returned once for the AM to share; only its keyed hash is stored.
 */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Add the client's name and email or phone.");
  try {
    const res = await routeProjectAccess(input.projectId);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Project not found.");
    const access = res.access;
    if (access.kind !== "member" || !canManageProjects(access.role)) {
      return jsonError(403, "Only owners and account managers can invite clients.");
    }
    const { token, hash } = newInviteToken(signingSecret());
    const invite = await insertInvite({
      project_id: input.projectId,
      email_or_phone: input.emailOrPhone,
      display_name: input.name,
      role: input.role,
      token_hash: hash,
      expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      created_by: access.userId,
    });
    return ok({ id: invite.id, link: `${appUrl()}/join/${token}`, expiresAt: invite.expires_at }, 201);
  } catch (err) {
    return handleRouteError("invites", err);
  }
}
