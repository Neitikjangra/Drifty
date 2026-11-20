import { getGuestRole, revokeInvite } from "@/lib/db/repo";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { createInvite, manageableInvite } from "@/lib/invite-admin";

const STATUS_MSG = { 401: "Please sign in first.", 403: "Only owners and account managers can do this.", 404: "Invite not found." };

/**
 * POST /api/invites/:id/reissue: a fresh 30-day link for the same person (same identity,
 * same chat history). The old link is cancelled; access isn't interrupted. Owner/AM only.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/invites/[id]/reissue">) {
  const { id } = await ctx.params;
  try {
    const res = await manageableInvite(id);
    if (!res.ok) return jsonError(res.status, STATUS_MSG[res.status]);
    const { invite, access } = res;
    // Keep their current role if they're in the project (the approver may have changed since).
    const currentRole = invite.used_by ? await getGuestRole(invite.project_id, invite.used_by) : null;
    const fresh = await createInvite({
      projectId: invite.project_id,
      emailOrPhone: invite.email_or_phone,
      name: invite.display_name,
      role: currentRole ?? invite.role,
      createdBy: access.userId,
      usedBy: invite.used_by,
    });
    if (!invite.revoked_at) await revokeInvite(invite.id);
    return ok({ id: fresh.invite.id, link: fresh.link, expiresAt: fresh.invite.expires_at }, 201);
  } catch (err) {
    return handleRouteError("invites/reissue", err);
  }
}
