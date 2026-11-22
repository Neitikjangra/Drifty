import { routeProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { getDeliverable, getVersion } from "@/lib/db/deliverables";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { sendGroupMessage, setGroupMessageMetadata } from "@/lib/nexconn/api";
import { BOT_USER_ID } from "@/lib/nexconn/ids";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/changelists/:id/brief: the AM sends the confirmed items to the team as the
 * creative's brief (FR-9), in the internal room. Nothing goes to the client.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/changelists/[id]/brief">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Change list not found.");
  try {
    const db = supabaseAdmin();
    const { data: cl } = await db.from("change_lists").select("id, version_id, card_message_id").eq("id", id).maybeSingle();
    const list = cl as { id: string; version_id: string; card_message_id: string | null } | null;
    if (!list) return jsonError(404, "Change list not found.");
    const v = await getVersion(list.version_id);
    const d = v ? await getDeliverable(v.deliverable_id) : null;
    if (!v || !d) return jsonError(404, "Change list not found.");
    const res = await routeProjectAccess(d.project_id);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Change list not found.");
    const limited = await rateLimit(req, "brief", LIMITS.write, res.access.userId);
    if (limited) return limited;
    if (res.access.kind !== "member" || !canManageProjects(res.access.role)) {
      return jsonError(403, "Only owners and account managers can send the brief.");
    }
    const { data: items } = await db
      .from("change_items")
      .select("text, type, status, position")
      .eq("version_id", v.id)
      .eq("status", "confirmed")
      .order("position", { ascending: true });
    const confirmed = (items ?? []) as { text: string; type: string }[];
    if (confirmed.length === 0) return jsonError(400, "Confirm at least one item first.");

    const project = res.access.project;
    const text = [
      `Brief for ${d.title} v${v.number + 1} (from ${confirmed.length} confirmed change${confirmed.length > 1 ? "s" : ""}):`,
      ...confirmed.map((it, i) => `${i + 1}. ${it.text}${it.type === "question" ? " (question for the client)" : ""}`),
      "Upload the new version from the project page when it's ready.",
    ].join("\n");
    await sendGroupMessage({
      fromUserId: BOT_USER_ID,
      channelId: project.internal_channel_id!,
      messageType: "RC:TxtMsg",
      content: { content: text.slice(0, 4000) },
    });
    const sentAt = new Date().toISOString();
    await db.from("change_lists").update({ brief_sent_at: sentAt }).eq("id", list.id);
    if (list.card_message_id) {
      await setGroupMessageMetadata({
        messageId: list.card_message_id,
        operatorUserId: BOT_USER_ID,
        channelId: project.internal_channel_id!,
        metadata: { brief: sentAt },
      }).catch(() => {});
    }
    return ok({ sent: confirmed.length });
  } catch (err) {
    return handleRouteError("brief", err);
  }
}
