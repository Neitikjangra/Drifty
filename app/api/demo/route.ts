import { getCaller } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { findDemoProject, seedDemoProject } from "@/lib/demo/seed";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

/**
 * POST /api/demo: adds the demo project to the caller's workspace (one per workspace).
 * Owner/AM only. Demo projects don't count towards the plan's active clients.
 */
export async function POST(req: Request) {
  try {
    const caller = await getCaller();
    if (caller.kind !== "member") return jsonError(401, "Please sign in first.");
    if (!caller.membership) return jsonError(403, "Finish setting up your workspace first.");
    if (!canManageProjects(caller.membership.role)) return jsonError(403, "Only owners and account managers can add the demo.");
    const limited = await rateLimit(req, "demo", [{ limit: 5, windowSec: 3600, by: "user" }], caller.userId);
    if (limited) return limited;
    const existing = await findDemoProject(caller.membership.workspace.id);
    if (existing) return ok({ projectId: existing, existing: true });
    const { projectId } = await seedDemoProject({
      workspaceId: caller.membership.workspace.id,
      createdBy: caller.userId,
      origin: new URL(req.url).origin,
    });
    return ok({ projectId }, 201);
  } catch (err) {
    return handleRouteError("demo", err);
  }
}
