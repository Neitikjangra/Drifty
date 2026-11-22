import { z } from "zod";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { approveVersion } from "@/lib/deliverables/approve";
import { approverContext } from "@/lib/deliverables/approver";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { setGroupMessageMetadata } from "@/lib/nexconn/api";
import { BOT_USER_ID } from "@/lib/nexconn/ids";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

const body = z.object({ answer: z.enum(["yes", "no"]) });

/**
 * POST /api/approval-checks/:id: the approver answers "Does this approve all of vX?" (FR-16).
 * Yes = a real approval through the same path as the card's Approve button (ledger row,
 * green card, receipt). No = nothing is approved. Approver only, verified on the server.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/approval-checks/[id]">) {
  const { id } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Answer yes or no.");
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Not found.");
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("drift_alerts").select("id, kind, version_id, card_message_id, resolved_at").eq("id", id).maybeSingle();
    const alert = data as { id: string; kind: string; version_id: string; card_message_id: string | null; resolved_at: string | null } | null;
    if (!alert || alert.kind !== "approval") return jsonError(404, "Not found.");
    const c = await approverContext(alert.version_id);
    if (!c.ok) return jsonError(c.status, c.status === 403 ? "Only the project's approver can answer this." : c.error);
    const limited = await rateLimit(req, "approval-check", LIMITS.write, c.access.userId);
    if (limited) return limited;
    if (alert.resolved_at) return jsonError(409, "This was already answered.");

    // Claim the answer first (no double answers), then act.
    const claim = await db
      .from("drift_alerts")
      .update({ resolved_by: c.access.userId, resolved_at: new Date().toISOString(), detail: { answer: input.answer } })
      .eq("id", alert.id)
      .is("resolved_at", null)
      .select("id");
    if (!claim.data?.length) return jsonError(409, "This was already answered.");

    if (input.answer === "yes") {
      const r = await approveVersion(c.v, c.d, c.access);
      if (!r.ok) {
        await db.from("drift_alerts").update({ resolved_by: null, resolved_at: null, detail: {} }).eq("id", alert.id);
        return jsonError(r.status, r.error);
      }
    }
    const name = c.access.profile?.display_name ?? "The approver";
    if (alert.card_message_id && c.access.project.client_channel_id) {
      await setGroupMessageMetadata({
        messageId: alert.card_message_id,
        operatorUserId: BOT_USER_ID,
        channelId: c.access.project.client_channel_id,
        metadata: { status: input.answer, by: name.slice(0, 64) },
      }).catch(() => {});
    }
    return ok({ answer: input.answer, version: c.v.number });
  } catch (err) {
    return handleRouteError("approval-checks", err);
  }
}
