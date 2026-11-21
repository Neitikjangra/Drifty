import { routeProjectAccess } from "@/lib/access";
import { AiError } from "@/lib/ai/gemini";
import { canManageProjects } from "@/lib/auth/permissions";
import { getDeliverable } from "@/lib/db/deliverables";
import { SummariseError, summarise } from "@/lib/feedback/summarise";
import { handleRouteError, jsonError, ok } from "@/lib/http";

// AI calls can take several seconds (NFR-1 target: within 15 s).
export const maxDuration = 60;

/** POST /api/deliverables/:id/summarise: runs AI-1 + AI-2 (FR-8, FR-12). Owner/AM only. */
export async function POST(_req: Request, ctx: RouteContext<"/api/deliverables/[id]/summarise">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Deliverable not found.");
  try {
    const d = await getDeliverable(id);
    if (!d) return jsonError(404, "Deliverable not found.");
    const res = await routeProjectAccess(d.project_id);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Deliverable not found.");
    if (res.access.kind !== "member" || !canManageProjects(res.access.role)) {
      return jsonError(403, "Only owners and account managers can summarise feedback.");
    }
    if (d.status === "approved") return jsonError(409, "This deliverable is already approved.");
    if (d.status === "draft") return jsonError(409, `v${d.current_version} is waiting for the drift check. Send it to the client first.`);
    const out = await summarise(res.access.project, d, res.access.userId);
    return ok(out, 201);
  } catch (err) {
    if (err instanceof SummariseError) return jsonError(err.status, err.message);
    if (err instanceof AiError) return jsonError(503, err.message);
    return handleRouteError("summarise", err);
  }
}
