import { after } from "next/server";
import { verifySignature } from "@/lib/nexconn/sign";
import { isFreshTimestamp, parseWebhookMessage, type WebhookMessage } from "@/lib/messages/parse";
import { projectForChannel, storeMessage } from "@/lib/messages/store";
import { transcribeVoice } from "@/lib/messages/voice";
import { runJob } from "@/lib/jobs";
import { maybeAskApproval } from "@/lib/round6/approval-check";
import { notifyRoomMessage } from "@/lib/push/send";

/**
 * POST /api/nexconn/webhook: Nexconn `message:send` events (FR-8 input).
 * Verifies the signature (sha1(AppSecret+Nonce+Timestamp), docs webhook/overview), rejects
 * stale timestamps (replays), dedupes on the Nexconn message id, stores the message, and
 * answers 200 fast; voice transcription runs after the response.
 */
export async function POST(req: Request) {
  const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY?.trim().replace(/^"(.*)"$/, "$1");
  const secret = process.env.NEXCONN_APP_SECRET?.trim().replace(/^"(.*)"$/, "$1");
  if (!appKey || !secret) return new Response("not configured", { status: 503 });

  const nonce = req.headers.get("nonce") ?? "";
  const timestamp = req.headers.get("timestamp") ?? "";
  const signature = req.headers.get("signature") ?? "";
  const headerKey = req.headers.get("appkey") ?? req.headers.get("app-key") ?? "";
  if (headerKey !== appKey || !nonce || !signature || !verifySignature(secret, nonce, timestamp, signature)) {
    return new Response("invalid signature", { status: 401 });
  }
  if (!isFreshTimestamp(timestamp)) return new Response("stale", { status: 401 });

  const body = (await req.json().catch(() => null)) as { type?: string; data?: WebhookMessage[] } | null;
  if (!body || body.type !== "message:send" || !Array.isArray(body.data)) {
    return Response.json({ ok: true, ignored: true }); // other events: acknowledge so Nexconn doesn't retry
  }

  let stored = 0;
  for (const raw of body.data.slice(0, 20)) {
    try {
      const m = parseWebhookMessage(raw);
      if (!m) continue;
      const project = await projectForChannel(m.channelId);
      if (!project) continue;
      const res = await storeMessage(project, m);
      if (res.inserted) stored++;
      // FR-16: a vague "ok"/👍 from the approver gets a "Does this approve all of vX?" card.
      if (res.inserted && m.kind === "text") {
        after(() => maybeAskApproval(project, m).catch(() => console.warn("[webhook] approval check failed")));
      }
      if (res.inserted && (m.kind === "text" || m.kind === "voice")) {
        after(() => notifyRoomMessage(project, m.channelId, m.authorId).catch(() => console.warn("[webhook] push failed")));
      }
      if (res.inserted && m.kind === "voice" && m.voiceRemoteUrl) {
        const id = m.nexconnMsgId;
        const remote = m.voiceRemoteUrl;
        // Our own voice notes point at /api/voice/:id; transcribe from storage instead of over HTTP.
        const ownPath = /\/api\/voice\/([0-9a-f-]{36})/.exec(remote)?.[1];
        after(() =>
          runJob("transcribe", { msg: id.slice(0, 64) }, () =>
            transcribeVoice({ nexconnMsgId: id, storagePath: ownPath ? undefined : null, remoteUrl: ownPath ? null : remote }),
          ),
        );
      }
    } catch {
      console.warn("[webhook] message not stored");
    }
  }
  return Response.json({ ok: true, stored });
}
