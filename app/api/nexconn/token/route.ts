import { supabaseServer } from "@/lib/db/supabase-server";
import { handleRouteError, jsonError } from "@/lib/http";
import { issueAccessToken } from "@/lib/nexconn/api";
import { nexconnUserId } from "@/lib/nexconn/ids";


/**
 * POST /api/nexconn/token
 * Issues a Nexconn access token for the signed-in Supabase user (creates the
 * Nexconn user on first call). The App Secret never leaves the server.
 * Round 1 adds: profile row with nexconn_user_id, channel membership checks.
 */
export async function POST() {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return jsonError(401, "Please sign in first.");

    const user = data.user;
    const userId = nexconnUserId(user.id);
    const name =
      (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Drifty user";

    const token = await issueAccessToken(userId, name);
    return Response.json({ token, userId }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleRouteError("nexconn/token", err);
  }
}
