import { z } from "zod";
import { getCaller } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { countActiveClientProjects, deleteProject, insertProject, setProjectChannels, workspaceMemberNexconnIds } from "@/lib/db/repo";
import { canAddClient, PLAN_LIMIT_MESSAGE } from "@/lib/plans";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { createProjectRooms } from "@/lib/nexconn/rooms";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

const body = z.object({ clientName: z.string().trim().min(1).max(64) });

/**
 * POST /api/projects: creates a project plus its client room and internal room as
 * Nexconn group channels with the Drifty AI bot (FR-2). Owner/AM only.
 */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Enter the client's name.");
  try {
    const caller = await getCaller();
    if (caller.kind !== "member") return jsonError(401, "Please sign in first.");
    const limited = await rateLimit(req, "projects", LIMITS.write, caller.userId);
    if (limited) return limited;
    if (!caller.membership) return jsonError(403, "Finish setting up your workspace first.");
    if (!canManageProjects(caller.membership.role)) return jsonError(403, "Only owners and account managers can create projects.");

    const ws = caller.membership.workspace.id;
    if (!canAddClient(caller.membership.workspace.plan, await countActiveClientProjects(ws))) {
      return jsonError(403, PLAN_LIMIT_MESSAGE, { code: "plan_limit" });
    }
    const project = await insertProject(ws, input.clientName);
    try {
      const [clientMembers, internalMembers] = await Promise.all([
        workspaceMemberNexconnIds(ws, ["owner", "am"]),
        workspaceMemberNexconnIds(ws),
      ]);
      const rooms = await createProjectRooms({
        projectId: project.id,
        clientName: input.clientName,
        clientRoomMembers: clientMembers,
        internalRoomMembers: internalMembers,
      });
      await setProjectChannels(project.id, rooms.client, rooms.internal);
    } catch (err) {
      // Don't leave a project without rooms behind.
      await deleteProject(project.id).catch(() => {});
      throw err;
    }
    return ok({ id: project.id }, 201);
  } catch (err) {
    return handleRouteError("projects", err);
  }
}
