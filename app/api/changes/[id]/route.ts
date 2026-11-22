import { z } from "zod";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { manageableItem } from "@/lib/feedback/access";
import { setItemOnCard } from "@/lib/feedback/summarise";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("edit"), text: z.string().trim().min(1).max(1000) }),
]);

const MSG = { 401: "Please sign in first.", 403: "Only owners and account managers can do this.", 404: "Change item not found." };

/**
 * PATCH /api/changes/:id: the AM confirms, edits (which also confirms) or rejects an AI
 * suggestion (FR-9). The AI never confirms anything itself. Updates the card in place.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/changes/[id]">) {
  const { id } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Choose confirm, edit or reject.");
  try {
    const res = await manageableItem(id);
    if (!res.ok) return jsonError(res.status, MSG[res.status]);
    const { item, access, cardMessageId } = res;
    const limited = await rateLimit(req, "changes", LIMITS.write, access.userId);
    if (limited) return limited;
    if (!["suggested", "confirmed", "rejected"].includes(item.status)) {
      return jsonError(409, "This item was already checked against a new version.");
    }
    // The approver settled this conflict (FR-12): the team can't bring back the option they turned down.
    if (item.conflict_id && item.status === "rejected" && input.action !== "reject") {
      return jsonError(409, "The approver chose the other option for this conflict.");
    }
    const patch =
      input.action === "edit"
        ? { text: input.text, status: "confirmed", confirmed_by: access.userId }
        : input.action === "confirm"
          ? { status: "confirmed", confirmed_by: access.userId }
          : { status: "rejected", confirmed_by: access.userId };
    const { error } = await supabaseAdmin().from("change_items").update(patch).eq("id", item.id);
    if (error) throw new Error("update failed");
    if (item.position !== null) {
      await setItemOnCard(access.project, cardMessageId, item.position, {
        s: patch.status,
        ...(input.action === "edit" ? { t: input.text.slice(0, 300) } : {}),
      });
    }
    return ok({ status: patch.status });
  } catch (err) {
    return handleRouteError("changes", err);
  }
}
