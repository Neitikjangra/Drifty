import { getCaller } from "@/lib/access";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { issueAccessToken } from "@/lib/nexconn/api";

/**
 * POST /api/nexconn/token: a Nexconn access token for the signed-in agency user or
 * the joined client guest (creates the Nexconn user on first call). Which rooms the
 * token can reach is decided by Nexconn channel membership, which only the server sets.
 */
export async function POST() {
  try {
    const caller = await getCaller();
    if (caller.kind === "anonymous") return jsonError(401, "Please sign in or open your invite link again.");
    if (!caller.profile) return jsonError(403, "Finish setting up your account first.");
    const token = await issueAccessToken(caller.profile.nexconn_user_id, caller.profile.display_name);
    return ok({ token, userId: caller.profile.nexconn_user_id });
  } catch (err) {
    return handleRouteError("nexconn/token", err);
  }
}
