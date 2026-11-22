import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { sendGroupMessage, setGroupMessageMetadata } from "@/lib/nexconn/api";
import { BOT_USER_ID } from "@/lib/nexconn/ids";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), text: z.string().trim().min(10).max(600) }),
  z.object({ action: z.literal("discard") }),
]);

/**
 * POST /api/scope/:id: the AM sends (as themselves, in the client room) or discards the
 * scope-drift note (FR-15). The AI only drafts it. Owners/AMs only, verified on the server.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/scope/[id]">) {
  const { id } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Write the note (at least 10 characters) or discard it.");
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Not found.");
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("drift_alerts").select("id, kind, deliverable_id, card_message_id, resolved_at").eq("id", id).maybeSingle();
    const alert = data as { id: string; kind: string; deliverable_id: string; card_message_id: string | null; resolved_at: string | null } | null;
    if (!alert || alert.kind !== "scope") return jsonError(404, "Not found.");
    const { data: dRow } = await db.from("deliverables").select("project_id").eq("id", alert.deliverable_id).maybeSingle();
    if (!dRow) return jsonError(404, "Not found.");
    const res = await routeProjectAccess((dRow as { project_id: string }).project_id);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Not found.");
    const access = res.access;
    if (access.kind !== "member" || !canManageProjects(access.role)) return jsonError(403, "Only owners and account managers can do this.");
    const limited = await rateLimit(req, "scope", LIMITS.write, access.userId);
    if (limited) return limited;
    if (alert.resolved_at) return jsonError(409, "This was already handled.");
    const me = access.profile;
    if (input.action === "send" && (!me?.nexconn_user_id || !access.project.client_channel_id)) return jsonError(409, "The client room isn't ready.");

    const claim = await db
      .from("drift_alerts")
      .update({ resolved_by: access.userId, resolved_at: new Date().toISOString() })
      .eq("id", alert.id)
      .is("resolved_at", null)
      .select("id");
    if (!claim.data?.length) return jsonError(409, "This was already handled.");

    if (input.action === "send") {
      try {
        // Posted as the AM's own message: the client hears it from a person, not the bot.
        await sendGroupMessage({
          fromUserId: me!.nexconn_user_id,
          channelId: access.project.client_channel_id!,
          messageType: "RC:TxtMsg",
          content: { content: input.text },
        });
      } catch (err) {
        await db.from("drift_alerts").update({ resolved_by: null, resolved_at: null }).eq("id", alert.id);
        throw err;
      }
    }
    if (alert.card_message_id && access.project.internal_channel_id) {
      await setGroupMessageMetadata({
        messageId: alert.card_message_id,
        operatorUserId: BOT_USER_ID,
        channelId: access.project.internal_channel_id,
        metadata: {
          status: input.action === "send" ? "sent" : "discarded",
          by: (me?.display_name ?? "AM").slice(0, 64),
          ...(input.action === "send" ? { text: input.text.slice(0, 600) } : {}),
        },
      }).catch(() => {});
    }
    return ok({ status: input.action === "send" ? "sent" : "discarded" });
  } catch (err) {
    return handleRouteError("scope", err);
  }
}
