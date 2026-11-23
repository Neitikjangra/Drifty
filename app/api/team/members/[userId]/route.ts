import { getCaller } from "@/lib/access";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { listTeam, removeTeammate } from "@/lib/team/server";

/** DELETE /api/team/members/:userId: removes a teammate from the workspace and its rooms. Owner only. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/team/members/[userId]">) {
  const { userId } = await ctx.params;
  try {
    const caller = await getCaller();
    if (caller.kind !== "member") return jsonError(401, "Please sign in first.");
    if (!caller.membership || caller.membership.role !== "owner") return jsonError(403, "Only the owner can remove teammates.");
    const member = (await listTeam(caller.membership.workspace.id)).find((m) => m.userId === userId);
    if (!member) return jsonError(404, "Teammate not found.");
    if (member.role === "owner") return jsonError(400, "The owner can't be removed.");
    await removeTeammate(caller.membership.workspace.id, member);
    return ok({ removed: true });
  } catch (err) {
    return handleRouteError("team/members/remove", err);
  }
}
