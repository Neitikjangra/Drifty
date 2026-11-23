import { z } from "zod";
import { getCaller } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { countActiveClientProjects, deleteProject, insertProject, setProjectChannels, workspaceMemberNexconnIds } from "@/lib/db/repo";
import { canAddClient, PLAN_LIMIT_MESSAGE } from "@/lib/plans";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { createProjectRooms } from "@/lib/nexconn/rooms";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { createInvite } from "@/lib/invite-admin";
import { listTeam } from "@/lib/team/server";

const body = z.object({
  clientName: z.string().trim().min(1).max(64),
  /** What's agreed (e.g. "8 posts + 2 reels a month"); team only. */
  scope: z.string().trim().max(1000).optional(),
  roundsIncluded: z.number().int().min(1).max(20).optional(),
  brandRules: z.string().trim().max(4000).optional(),
  /** Creatives to put on this project (owners and account managers are always in). */
  teamIds: z.array(z.uuid()).max(50).optional(),
  /** Optional first client contact: gets an approver invite link right away. */
  contact: z.object({ name: z.string().trim().min(1).max(64), emailOrPhone: z.string().trim().min(3).max(120) }).optional(),
});

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
    let inviteLink: string | null = null;
    try {
      const team = await listTeam(ws);
      const creatives = team.filter((m) => m.role === "creative" && (input.teamIds ?? []).includes(m.userId));
      const clientMembers = await workspaceMemberNexconnIds(ws, ["owner", "am"]);
      const internalMembers = [...clientMembers, ...creatives.map((c) => c.nexconnId).filter((x): x is string => Boolean(x))];
      const details: Record<string, unknown> = {};
      if (input.scope) details.scope_text = input.scope;
      if (input.roundsIncluded) details.rounds_included = input.roundsIncluded;
      if (input.brandRules) details.brand_rules = input.brandRules;
      if (Object.keys(details).length) {
        const { error } = await supabaseAdmin().from("projects").update(details).eq("id", project.id);
        if (error) throw new Error("project details failed");
      }
      if (creatives.length) {
        const { error } = await supabaseAdmin().from("project_members").insert(creatives.map((c) => ({ project_id: project.id, user_id: c.userId })));
        if (error) throw new Error("project team failed");
      }
      const rooms = await createProjectRooms({
        projectId: project.id,
        clientName: input.clientName,
        clientRoomMembers: clientMembers,
        internalRoomMembers: internalMembers,
      });
      await setProjectChannels(project.id, rooms.client, rooms.internal);
      if (input.contact) {
        inviteLink = (
          await createInvite({ projectId: project.id, emailOrPhone: input.contact.emailOrPhone, name: input.contact.name, role: "approver", createdBy: caller.userId })
        ).link;
      }
    } catch (err) {
      // Don't leave a project without rooms behind.
      await deleteProject(project.id).catch(() => {});
      throw err;
    }
    return ok({ id: project.id, inviteLink }, 201);
  } catch (err) {
    return handleRouteError("projects", err);
  }
}
