import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { getGuestRole, setApprover } from "@/lib/db/repo";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";

const body = z
  .object({
    approverId: z.uuid().optional(),
    roundsIncluded: z.number().int().min(1).max(20).optional(),
  })
  .refine((b) => b.approverId !== undefined || b.roundsIncluded !== undefined);

/** PATCH /api/projects/:id: set the approver (must be a guest of this project) and/or rounds. Owner/AM only. */
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
    if (input.approverId) {
      if (!(await getGuestRole(id, input.approverId))) return jsonError(400, "The approver must be a client in this project.");
      await setApprover(id, input.approverId);
    }
    if (input.roundsIncluded !== undefined) {
      const res = await supabaseAdmin().from("projects").update({ rounds_included: input.roundsIncluded }).eq("id", id);
      if (res.error) throw new Error("update rounds failed");
    }
    return ok();
  } catch (err) {
    return handleRouteError("projects/patch", err);
  }
}
