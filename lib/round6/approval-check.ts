import "server-only";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Project } from "@/lib/db/types";
import type { ParsedMessage } from "@/lib/messages/parse";
import { sendGroupMessage } from "@/lib/nexconn/api";
import { BOT_USER_ID, MSG } from "@/lib/nexconn/ids";
import { ensureBot } from "@/lib/nexconn/rooms";
import type { ApprovalCheckCard } from "./cards";
import { isVagueApproval } from "./rules";

/**
 * FR-16 approval drift. When the project's approver sends a vague "ok"/👍 in the client room
 * (outside a card) while a version is in review, Drifty AI asks "Does this approve all of vX?".
 * It never approves by itself: only the approver's own "Yes" on that card does (same path as
 * the card's Approve button). One open question per version.
 */
export async function maybeAskApproval(project: Project, m: ParsedMessage): Promise<boolean> {
  if (m.kind !== "text" || !project.approver_id || m.channelId !== project.client_channel_id) return false;
  if (!isVagueApproval(m.text)) return false;
  const db = supabaseAdmin();
  const { data: prof } = await db.from("profiles").select("nexconn_user_id, display_name").eq("user_id", project.approver_id).maybeSingle();
  const approver = prof as { nexconn_user_id: string; display_name: string } | null;
  if (!approver || approver.nexconn_user_id !== m.authorId) return false; // only the approver's words matter

  // The version they most likely mean: the newest card in review.
  const { data: ds } = await db.from("deliverables").select("id, title, current_version").eq("project_id", project.id).eq("status", "in_review");
  const deliverables = (ds ?? []) as { id: string; title: string; current_version: number }[];
  if (!deliverables.length) return false;
  const { data: vs } = await db
    .from("versions")
    .select("id, deliverable_id, number, created_at, card_message_id")
    .in("deliverable_id", deliverables.map((d) => d.id))
    .not("card_message_id", "is", null)
    .order("created_at", { ascending: false });
  const current = ((vs ?? []) as { id: string; deliverable_id: string; number: number }[]).filter(
    (v) => deliverables.find((d) => d.id === v.deliverable_id)?.current_version === v.number,
  );
  const v = current[0];
  if (!v) return false;
  const d = deliverables.find((x) => x.id === v.deliverable_id)!;

  const { data: open } = await db.from("drift_alerts").select("id").eq("kind", "approval").eq("version_id", v.id).is("resolved_at", null).limit(1);
  if (open?.length) return false;

  const { data: alertRow, error } = await db
    .from("drift_alerts")
    .insert({ deliverable_id: d.id, version_id: v.id, kind: "approval", detail: { msgId: m.nexconnMsgId } })
    .select("id")
    .single();
  if (error || !alertRow) return false;
  const alertId = (alertRow as { id: string }).id;
  const card: ApprovalCheckCard = {
    alertId,
    deliverableId: d.id,
    versionId: v.id,
    version: v.number,
    title: d.title,
    quote: (m.text ?? "").slice(0, 80),
    approver: approver.display_name,
  };
  await ensureBot();
  const msgId = await sendGroupMessage({
    fromUserId: BOT_USER_ID,
    channelId: project.client_channel_id!,
    messageType: MSG.approvalCheck,
    content: card as unknown as Record<string, unknown>,
    pushContent: `Drifty AI: does that approve all of ${d.title} v${v.number}?`,
    metadata: { status: "open" },
  });
  await db.from("drift_alerts").update({ card_message_id: msgId }).eq("id", alertId);
  return true;
}
