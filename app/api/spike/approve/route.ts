import { z } from "zod";
import { spikeEnabled } from "@/lib/env";
import { handleRouteError, jsonError } from "@/lib/http";
import { META } from "@/lib/cards";
import { setGroupMessageMetadata } from "@/lib/nexconn/api";
import { BOT_USER_ID } from "@/lib/nexconn/ids";
import { SPIKE_CHANNEL_ID, SPIKE_USERS } from "@/lib/nexconn/spike";


const body = z.object({
  // Nexconn message ids look like "BRGM-DEN2-01E4-BN66".
  messageId: z.string().regex(/^[A-Za-z0-9-]{4,64}$/),
  user: z.enum(["alice", "bob"]),
});

/**
 * POST /api/spike/approve: the server (never the client) writes the card's status
 * through Nexconn message metadata. Round 2 replaces this with
 * /api/versions/:id/approve plus approver-role checks and an approvals row.
 */
export async function POST(req: Request) {
  if (!spikeEnabled()) return jsonError(404, "Not found");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid request.");

  try {
    await setGroupMessageMetadata({
      messageId: parsed.data.messageId,
      operatorUserId: BOT_USER_ID,
      channelId: SPIKE_CHANNEL_ID,
      metadata: {
        [META.status]: "approved",
        [META.actedBy]: SPIKE_USERS[parsed.data.user].name,
        [META.actedAt]: new Date().toISOString(),
      },
    });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleRouteError("spike/approve", err);
  }
}
