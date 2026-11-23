import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { countActiveClientProjects, getGuestRole, setApprover, setProjectArchived } from "@/lib/db/repo";
import { canAddClient, PLAN_LIMIT_MESSAGE } from "@/lib/plans";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getCaller } from "@/lib/access";
import { addToRoom, removeFromRoom } from "@/lib/nexconn/rooms";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { setProjectTeam } from "@/lib/team/server";
import { deleteProjectEverywhere } from "@/lib/projects/delete";

const body = z
  .object({
    approverId: z.uuid().optional(),
    roundsIncluded: z.number().int().min(1).max(20).optional(),
    archived: z.boolean().optional(),
    brandRules: z.string().trim().max(4000).optional(),
    scope: z.string().trim().max(1000).optional(),
    teamIds: z.array(z.uuid()).max(50).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined));

/** PATCH /api/projects/:id: set the approver (a guest of this project), rounds, or archive/restore. Owner/AM only. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Nothing to update.");
  try {
    const res = await routeProjectAccess(id);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Project not found.");
    const access = res.access;
    if (access.kind !== "member" || !canManageProjects(access.role)) {
      return jsonError(403, "Only owners and account managers can change this.");
    }
    const limited = await rateLimit(req, "projects-patch", LIMITS.write, access.userId);
    if (limited) return limited;
    if (input.archived === false && access.project.archived && !access.project.is_demo) {
      const caller = await getCaller();
      const plan = caller.kind === "member" ? (caller.membership?.workspace.plan ?? "free") : "free";
      if (!canAddClient(plan, await countActiveClientProjects(access.project.workspace_id))) {
        return jsonError(403, PLAN_LIMIT_MESSAGE, { code: "plan_limit" });
      }
    }
    if (input.archived !== undefined && input.archived !== access.project.archived) {
      await setProjectArchived(id, input.archived);
      // Clients leave the client room while archived (and come back on restore).
      const channel = access.project.client_channel_id;
      if (channel) {
        const { data } = await supabaseAdmin().from("project_guests").select("profiles(nexconn_user_id)").eq("project_id", id);
        const ids = ((data ?? []) as unknown as { profiles: { nexconn_user_id: string } | null }[])
          .map((g) => g.profiles?.nexconn_user_id)
          .filter((x): x is string => Boolean(x));
        if (ids.length) await (input.archived ? removeFromRoom(channel, ids) : addToRoom(channel, ids)).catch(() => {});
      }
    }
    if (input.approverId) {
      if (!(await getGuestRole(id, input.approverId))) return jsonError(400, "The approver must be a client in this project.");
      await setApprover(id, input.approverId);
    }
    if (input.roundsIncluded !== undefined) {
      const res = await supabaseAdmin().from("projects").update({ rounds_included: input.roundsIncluded }).eq("id", id);
      if (res.error) throw new Error("update rounds failed");
    }
    if (input.brandRules !== undefined || input.scope !== undefined) {
      const res = await supabaseAdmin()
        .from("projects")
        .update({ ...(input.brandRules !== undefined && { brand_rules: input.brandRules }), ...(input.scope !== undefined && { scope_text: input.scope }) })
        .eq("id", id);
      if (res.error) throw new Error("update project details failed");
    }
    if (input.teamIds) await setProjectTeam(access.project, input.teamIds);
    return ok();
  } catch (err) {
    return handleRouteError("projects/patch", err);
  }
}

const delBody = z.object({ confirmName: z.string().max(64) });

/**
 * DELETE /api/projects/:id: permanently deletes the project, its rooms, files and history.
 * Owner/AM only, the client's name must be typed to confirm, and a project with approvals is
 * refused: the approval ledger is permanent (archive it instead).
 */
export async function DELETE(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const input = await readBody(req, delBody);
  if (!input) return jsonError(400, "Type the client's name to confirm.");
  try {
    const res = await routeProjectAccess(id);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Project not found.");
    const access = res.access;
    if (access.kind !== "member" || !canManageProjects(access.role)) return jsonError(403, "Only owners and account managers can delete projects.");
    const limited = await rateLimit(req, "projects-delete", LIMITS.write, access.userId);
    if (limited) return limited;
    if (input.confirmName.trim().toLowerCase() !== access.project.client_name.trim().toLowerCase()) {
      return jsonError(400, "The name doesn't match. Type the client's name exactly to delete.");
    }
    const result = await deleteProjectEverywhere(access.project);
    if (!result.ok) return jsonError(409, result.error, { code: "has_approvals" });
    return ok({ deleted: true });
  } catch (err) {
    return handleRouteError("projects/delete", err);
  }
}
