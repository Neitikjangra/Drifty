import { projectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { getInvite, revokeInvite } from "@/lib/db/repo";
import { handleRouteError, jsonError, ok } from "@/lib/http";

/** POST /api/invites/:id/revoke: an unused invite link stops working (NFR-5). Owner/AM only. */
export async function POST(_req: Request, ctx: RouteContext<"/api/invites/[id]/revoke">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Invite not found.");
  try {
    const invite = await getInvite(id);
    if (!invite) return jsonError(404, "Invite not found.");
    const access = await projectAccess(invite.project_id);
    if (!access || access.kind !== "member" || !canManageProjects(access.role)) {
      return jsonError(404, "Invite not found.");
    }
    if (invite.used_at) return jsonError(409, "This invite was already used.");
    await revokeInvite(id);
    return ok();
  } catch (err) {
    return handleRouteError("invites/revoke", err);
  }
}
