import { getCaller } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { revokeTeamInvite } from "@/lib/team/server";

/** DELETE /api/team/invites/:id: cancels an unused team link. Owner/AM only. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/team/invites/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Link not found.");
  try {
    const caller = await getCaller();
    if (caller.kind !== "member") return jsonError(401, "Please sign in first.");
    if (!caller.membership || !canManageProjects(caller.membership.role)) return jsonError(403, "Only owners and account managers can cancel links.");
    if (!(await revokeTeamInvite(caller.membership.workspace.id, id))) return jsonError(404, "Link not found.");
    return ok({ revoked: true });
  } catch (err) {
    return handleRouteError("team/invites/revoke", err);
  }
}
