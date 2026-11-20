import { spikeEnabled } from "@/lib/env";
import { handleRouteError, jsonError } from "@/lib/http";
import type { DeliverableCard } from "@/lib/cards";
import { META } from "@/lib/cards";
import { sendGroupMessage } from "@/lib/nexconn/api";
import { BOT_USER_ID, MSG } from "@/lib/nexconn/ids";
import { ensureSpikeChannel, SPIKE_CHANNEL_ID } from "@/lib/nexconn/spike";


/** POST /api/spike/card: the bot posts a test deliverable card with metadata enabled. */
export async function POST() {
  if (!spikeEnabled()) return jsonError(404, "Not found");
  try {
    await ensureSpikeChannel();
    const n = Math.floor(Date.now() / 1000) % 1000;
    const card: DeliverableCard = {
      deliverableId: `spike-${n}`,
      versionId: `spike-${n}-v1`,
      version: 1,
      title: `Diwali post #${n}`,
      imageUrl: "/spike-card.svg",
      copy: "Light up your Diwali with 20% off. Shop now.",
      dueDate: null,
      status: "in_review",
    };
    const messageId = await sendGroupMessage({
      fromUserId: BOT_USER_ID,
      channelId: SPIKE_CHANNEL_ID,
      messageType: MSG.deliverable,
      content: card,
      pushContent: `New deliverable: ${card.title}`,
      metadata: { [META.status]: "in_review" },
    });
    return Response.json({ messageId }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleRouteError("spike/card", err);
  }
}
