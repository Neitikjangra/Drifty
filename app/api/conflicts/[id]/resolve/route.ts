import { z } from "zod";
import { getCaller, projectAccess } from "@/lib/access";
import { isProjectApprover } from "@/lib/auth/permissions";
import { getDeliverable } from "@/lib/db/deliverables";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { setItemOnCard } from "@/lib/feedback/summarise";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { sendGroupMessage, setGroupMessageMetadata } from "@/lib/nexconn/api";
import { BOT_USER_ID } from "@/lib/nexconn/ids";

const body = z.discriminatedUnion("choice", [
  z.object({ choice: z.literal("a") }),
  z.object({ choice: z.literal("b") }),
  z.object({ choice: z.literal("other"), text: z.string().trim().min(1).max(500) }),
]);

/**
 * POST /api/conflicts/:id/resolve: the approver settles conflicting feedback (FR-12).
 * The choice is recorded as a confirmed change item; the other option is rejected.
 * Approver only, verified on the server.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/conflicts/[id]/resolve">) {
  const { id } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Choose an option.");
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Not found.");
  try {
    const caller = await getCaller();
    if (caller.kind === "anonymous") return jsonError(401, "Open your invite link again to sign in.");
    const db = supabaseAdmin();
    const { data } = await db.from("drift_alerts").select("id, deliverable_id, version_id, kind, detail, card_message_id, resolved_at").eq("id", id).maybeSingle();
    const alert = data as {
      id: string;
      deliverable_id: string;
      version_id: string;
      kind: string;
      detail: { itemA: string; itemB: string; changeListId: string; indexA: number; indexB: number; summary: string };
      card_message_id: string | null;
      resolved_at: string | null;
    } | null;
    if (!alert || alert.kind !== "feedback") return jsonError(404, "Not found.");
    const d = await getDeliverable(alert.deliverable_id);
    const access = d ? await projectAccess(d.project_id, caller) : null;
    if (!d || !access) return jsonError(404, "Not found.");
    if (access.kind !== "guest" || !isProjectApprover(access, access.project)) {
      return jsonError(403, "Only the project's approver can decide this.");
    }
    if (alert.resolved_at) return jsonError(409, "This was already decided.");

    // Claim the decision atomically (no double answers).
    const claim = await db
      .from("drift_alerts")
      .update({ resolved_by: access.userId, resolved_at: new Date().toISOString() })
      .eq("id", alert.id)
      .is("resolved_at", null)
      .select("id");
    if (!claim.data?.length) return jsonError(409, "This was already decided.");

    const { detail } = alert;
    const { data: pair } = await db.from("change_items").select("id, text, position").in("id", [detail.itemA, detail.itemB]);
    const a = (pair ?? []).find((x: { id: string }) => x.id === detail.itemA) as { id: string; text: string; position: number | null } | undefined;
    const b = (pair ?? []).find((x: { id: string }) => x.id === detail.itemB) as { id: string; text: string; position: number | null } | undefined;
    const { data: cl } = await db.from("change_lists").select("card_message_id").eq("id", detail.changeListId).maybeSingle();
    const listCard = (cl as { card_message_id: string | null } | null)?.card_message_id ?? null;
    const project = access.project;

    let chosenText: string;
    const updates: Promise<unknown>[] = [];
    const mark = (item: typeof a, s: string) => {
      if (!item) return;
      updates.push(Promise.resolve(db.from("change_items").update({ status: s, conflict_id: alert.id }).eq("id", item.id)));
      if (item.position !== null) updates.push(setItemOnCard(project, listCard, item.position, { s }).catch(() => {}));
    };
    if (input.choice === "other") {
      chosenText = input.text;
      mark(a, "rejected");
      mark(b, "rejected");
      updates.push(
        Promise.resolve(
          db.from("change_items").insert({
            version_id: alert.version_id,
            change_list_id: detail.changeListId,
            text: input.text,
            type: "other",
            author_ids: [access.profile?.nexconn_user_id ?? ""],
            source_msg_ids: alert.card_message_id ? [alert.card_message_id] : [],
            status: "confirmed",
            origin: "conflict",
            conflict_id: alert.id,
          }),
        ),
      );
    } else {
      const [win, lose] = input.choice === "a" ? [a, b] : [b, a];
      chosenText = win?.text ?? "";
      mark(win, "confirmed");
      mark(lose, "rejected");
    }
    await Promise.all(updates);

    const name = access.profile?.display_name ?? "The approver";
    if (alert.card_message_id && project.client_channel_id) {
      await setGroupMessageMetadata({
        messageId: alert.card_message_id,
        operatorUserId: BOT_USER_ID,
        channelId: project.client_channel_id,
        metadata: { status: "resolved", choice: chosenText.slice(0, 500), by: name.slice(0, 64) },
      });
    }
    if (project.internal_channel_id) {
      await sendGroupMessage({
        fromUserId: BOT_USER_ID,
        channelId: project.internal_channel_id,
        messageType: "RC:TxtMsg",
        content: { content: `${name} settled a conflict on ${d.title}: "${chosenText.slice(0, 300)}". It's now a confirmed change.` },
      }).catch(() => {});
    }
    return ok({ choice: chosenText });
  } catch (err) {
    return handleRouteError("conflicts/resolve", err);
  }
}
