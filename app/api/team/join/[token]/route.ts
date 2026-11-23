import { z } from "zod";
import { getAgencyUser } from "@/lib/auth/session";
import { getMembership, upsertProfile } from "@/lib/db/repo";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { issueAccessToken } from "@/lib/nexconn/api";
import { nexconnUserId } from "@/lib/nexconn/ids";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { TEAM_INVITE_MESSAGES } from "@/lib/team/rules";
import { addManagerToRooms, claimTeamInvite, resolveTeamInvite } from "@/lib/team/server";

const body = z.object({ name: z.string().trim().min(1).max(64) });

/**
 * POST /api/team/join/:token: a signed-in agency user joins the workspace from a team link.
 * One workspace per person; the link works once. Account managers join every project's rooms;
 * creatives join a project's internal room when they're put on it.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/team/join/[token]">) {
  const { token } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Enter your name.");
  try {
    const limited = await rateLimit(req, "team-join", LIMITS.join);
    if (limited) return limited;
    const user = await getAgencyUser();
    if (!user) return jsonError(401, "Sign in or create an account first.");
    const inv = await resolveTeamInvite(token);
    if (inv.state === "invalid") return jsonError(404, "This team link isn't valid.");
    if (inv.state !== "ok") return jsonError(410, TEAM_INVITE_MESSAGES[inv.state]);
    const existing = await getMembership(user.id);
    if (existing) {
      return existing.workspace.id === inv.workspaceId
        ? ok({ joined: true, already: true })
        : jsonError(409, "Your account already belongs to another agency workspace. Sign in with a different email to join this one.");
    }
    if (!(await claimTeamInvite(inv.id, user.id))) return jsonError(410, TEAM_INVITE_MESSAGES.used);

    const nexconnId = nexconnUserId(user.id);
    await upsertProfile({ user_id: user.id, display_name: input.name, email: user.email, nexconn_user_id: nexconnId });
    await issueAccessToken(nexconnId, input.name);
    const { error } = await supabaseAdmin().from("members").insert({ workspace_id: inv.workspaceId, user_id: user.id, role: inv.role });
    if (error) throw new Error(`team join ${error.code ?? ""}`);
    if (inv.role === "am") await addManagerToRooms(inv.workspaceId, nexconnId);
    return ok({ joined: true }, 201);
  } catch (err) {
    return handleRouteError("team/join", err);
  }
}
