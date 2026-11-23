import { z } from "zod";
import { getCaller } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { appUrl } from "@/lib/env";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { createTeamInvite } from "@/lib/team/server";

const body = z.object({ role: z.enum(["am", "creative"]) });

/** POST /api/team/invites: a one-time link (7 days) for a teammate to join the workspace. Owner/AM only. */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Pick a role.");
  try {
    const caller = await getCaller();
    if (caller.kind !== "member") return jsonError(401, "Please sign in first.");
    if (!caller.membership || !canManageProjects(caller.membership.role)) return jsonError(403, "Only owners and account managers can invite teammates.");
    if (input.role === "am" && caller.membership.role !== "owner") return jsonError(403, "Only the owner can invite account managers.");
    const limited = await rateLimit(req, "team-invites", LIMITS.write, caller.userId);
    if (limited) return limited;
    const { id, token } = await createTeamInvite(caller.membership.workspace.id, input.role, caller.userId);
    return ok({ id, link: `${appUrl()}/team/join/${token}` }, 201);
  } catch (err) {
    return handleRouteError("team/invites", err);
  }
}
