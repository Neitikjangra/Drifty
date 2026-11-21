import "server-only";
import { META, type CardStatus, type DeliverableCard, type ReceiptCard } from "@/lib/cards";
import type { Deliverable, Version } from "@/lib/db/deliverables";
import type { Project } from "@/lib/db/types";
import { sendGroupMessage, setGroupMessageMetadata } from "@/lib/nexconn/api";
import { BOT_USER_ID, MSG } from "@/lib/nexconn/ids";
import { ensureBot } from "@/lib/nexconn/rooms";

/** Posts the `drifty:deliverable` card for a version in the client room (FR-4). Returns the message id. */
export async function postDeliverableCard(project: Project, d: Deliverable, v: Version): Promise<string> {
  await ensureBot();
  const card: DeliverableCard = {
    deliverableId: d.id,
    versionId: v.id,
    version: v.number,
    title: d.title,
    imageUrl: `/api/assets/${v.id}`,
    copy: v.copy_text,
    dueDate: d.due_date,
    status: "in_review",
    assetKind: v.asset_mime === "application/pdf" ? "pdf" : "image",
  };
  return sendGroupMessage({
    fromUserId: BOT_USER_ID,
    channelId: project.client_channel_id!,
    messageType: MSG.deliverable,
    content: card,
    pushContent: `New for review: ${d.title} v${v.number}`,
    metadata: { [META.status]: "in_review" },
  });
}

/** Updates a card's status in place for everyone (FR-6). Server-only; clients never write it. */
export async function setCardStatus(project: Project, v: Version, status: CardStatus, actedBy?: string) {
  if (!v.card_message_id || !project.client_channel_id) return;
  await setGroupMessageMetadata({
    messageId: v.card_message_id,
    operatorUserId: BOT_USER_ID,
    channelId: project.client_channel_id,
    metadata: {
      [META.status]: status,
      ...(actedBy ? { [META.actedBy]: actedBy.slice(0, 64), [META.actedAt]: new Date().toISOString() } : {}),
    },
  });
}

/** Posts the approval receipt (`drifty:receipt`) in the client room. */
export async function postReceipt(project: Project, d: Deliverable, v: Version, approver: string, approvedAt: string) {
  const content: ReceiptCard = { versionId: v.id, version: v.number, title: d.title, approver, approvedAt };
  await sendGroupMessage({
    fromUserId: BOT_USER_ID,
    channelId: project.client_channel_id!,
    messageType: MSG.receipt,
    content: content as unknown as Record<string, unknown>,
    pushContent: `${approver} approved ${d.title} v${v.number}`,
  });
}

/** Posts a plain text message as a person (e.g. the approver's change request note). */
export async function postTextAs(project: Project, nexconnUserId: string, text: string) {
  await sendGroupMessage({
    fromUserId: nexconnUserId,
    channelId: project.client_channel_id!,
    messageType: "RC:TxtMsg",
    content: { content: text.slice(0, 2000) },
  });
}
