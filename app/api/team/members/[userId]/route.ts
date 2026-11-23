import { getCaller } from "@/lib/access";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { z } from "zod";
import { readBody } from "@/lib/http";
import { JOB_ROLE_IDS, jobRole } from "@/lib/team/rules";
import { changeTeammateRole, listTeam, removeTeammate } from "@/lib/team/server";

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

const patchBody = z.object({ title: z.enum(JOB_ROLE_IDS) });

/** PATCH /api/team/members/:userId: give a teammate a different job role (and access). Owner only. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/team/members/[userId]">) {
  const { userId } = await ctx.params;
  const input = await readBody(req, patchBody);
  if (!input) return jsonError(400, "Pick a role.");
  try {
    const caller = await getCaller();
    if (caller.kind !== "member") return jsonError(401, "Please sign in first.");
    if (!caller.membership || caller.membership.role !== "owner") return jsonError(403, "Only the owner can change roles.");
    const member = (await listTeam(caller.membership.workspace.id)).find((m) => m.userId === userId);
    if (!member) return jsonError(404, "Teammate not found.");
    if (member.role === "owner") return jsonError(400, "The owner's role can't be changed.");
    const job = jobRole(input.title)!;
    await changeTeammateRole(caller.membership.workspace.id, member, job.access, job.id);
    return ok({ role: job.access, title: job.id });
  } catch (err) {
    return handleRouteError("team/members/role", err);
  }
}
