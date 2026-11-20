import { z } from "zod";
import { getAgencyUser } from "@/lib/auth/session";
import { createWorkspaceWithOwner, getMembership, upsertProfile } from "@/lib/db/repo";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { issueAccessToken } from "@/lib/nexconn/api";
import { nexconnUserId } from "@/lib/nexconn/ids";

const body = z.object({
  workspaceName: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(64),
});

/** POST /api/onboarding: first-run setup (FR-1). Creates profile, Nexconn user, workspace, owner membership. */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Enter your name and a workspace name.");
  try {
    const user = await getAgencyUser();
    if (!user) return jsonError(401, "Please sign in first.");
    if (await getMembership(user.id)) return ok({ alreadyDone: true });

    const nexconnId = nexconnUserId(user.id);
    await upsertProfile({
      user_id: user.id,
      display_name: input.displayName,
      email: user.email,
      nexconn_user_id: nexconnId,
    });
    // Registers the Nexconn user now so project rooms can include them.
    await issueAccessToken(nexconnId, input.displayName);
    await createWorkspaceWithOwner(input.workspaceName, user.id);
    return ok({}, 201);
  } catch (err) {
    return handleRouteError("onboarding", err);
  }
}
