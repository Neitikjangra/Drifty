import { getCaller } from "@/lib/access";
import { setGuestCookie } from "@/lib/auth/session";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { issueAccessToken } from "@/lib/nexconn/api";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/nexconn/token: a Nexconn access token for the signed-in agency user or
 * the joined client guest (creates the Nexconn user on first call). Which rooms the
 * token can reach is decided by Nexconn channel membership, which only the server sets.
 */
export async function POST(req: Request) {
  try {
    const caller = await getCaller();
    if (caller.kind === "anonymous") return jsonError(401, "Please sign in or open your invite link again.");
    const limited = await rateLimit(req, "token", LIMITS.token, caller.userId);
    if (limited) return limited;
    if (!caller.profile) return jsonError(403, "Finish setting up your account first.");
    const token = await issueAccessToken(caller.profile.nexconn_user_id, caller.profile.display_name);
    // Clients: renew the 30-day session on every visit, so regular users never get logged out.
    if (caller.kind === "guest") await setGuestCookie(caller.userId);
    return ok({ token, userId: caller.profile.nexconn_user_id });
  } catch (err) {
    return handleRouteError("nexconn/token", err);
  }
}
