import { z } from "zod";
import { getAgencyUser } from "@/lib/auth/session";
import { createWorkspaceWithOwner, DbError, getMembership, upsertProfile } from "@/lib/db/repo";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { issueAccessToken } from "@/lib/nexconn/api";
import { nexconnUserId } from "@/lib/nexconn/ids";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { seedDemoProject } from "@/lib/demo/seed";

export const maxDuration = 60; // the optional demo project takes a few seconds

const body = z.object({
  workspaceName: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(64),
  /** Add the demo project (first-run onboarding, on by default in the form). */
  withDemo: z.boolean().optional(),
});

/** POST /api/onboarding: first-run setup (FR-1). Creates profile, Nexconn user, workspace, owner membership. */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Enter your name and a workspace name.");
  try {
    const user = await getAgencyUser();
    if (!user) return jsonError(401, "Please sign in first.");
    const limited = await rateLimit(req, "onboarding", LIMITS.write, user.id);
    if (limited) return limited;
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
    const workspaceId = await createWorkspaceWithOwner(input.workspaceName, user.id);
    // The workspace is ready either way; a demo hiccup must not block sign-up.
    let demoProjectId: string | null = null;
    if (input.withDemo) {
      // One retry: a failed attempt removes its half-made project, so trying again is safe.
      for (let attempt = 1; attempt <= 2 && !demoProjectId; attempt++) {
        try {
          demoProjectId = (await seedDemoProject({ workspaceId, createdBy: user.id, origin: new URL(req.url).origin })).projectId;
        } catch (err) {
          console.error(`[onboarding] demo seed failed (attempt ${attempt}): ${err instanceof DbError ? err.message : err instanceof Error ? err.name : "error"}`);
        }
      }
    }
    return ok({ demoProjectId }, 201);
  } catch (err) {
    return handleRouteError("onboarding", err);
  }
}
