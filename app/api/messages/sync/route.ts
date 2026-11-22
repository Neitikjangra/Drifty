import { after } from "next/server";
import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { runJob } from "@/lib/jobs";
import { parseWebhookMessage } from "@/lib/messages/parse";
import { storeMessage } from "@/lib/messages/store";
import { transcribeVoice } from "@/lib/messages/voice";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

const body = z.object({
  projectId: z.uuid(),
  messages: z
    .array(
      z.object({
        messageId: z.string().min(1).max(64),
        senderUserId: z.string().min(1).max(64),
        sentTime: z.number().int().positive(),
        messageType: z.string().min(1).max(32),
        content: z.unknown(),
      }),
    )
    .max(200),
});

/**
 * The Web SDK's content shapes differ from the webhook's wire format (installed
 * @nexconn/chat types: TextMessageContent.text, ReferenceMessageContent.text + referMsg),
 * so map them to what parseWebhookMessage reads ({content}, {content, referMsg: {content}}).
 */
function toWire(messageType: string, raw: unknown): Record<string, unknown> {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v : undefined);
  if (messageType === "RC:TxtMsg") return { content: text(c.text) ?? text(c.content) ?? "" };
  if (messageType === "RC:ReferenceMsg") {
    const ref = (c.referMsg && typeof c.referMsg === "object" ? c.referMsg : {}) as Record<string, unknown>;
    return { content: text(c.text) ?? text(c.content) ?? "", referMsg: { content: text(ref.text) ?? text(ref.content) ?? "" } };
  }
  return c; // voice: remoteUrl + duration already match
}

/**
 * POST /api/messages/sync: a safety net for the Nexconn webhook. Before Summarise, the agency's
 * browser reads the client room's recent history through the Chat SDK and sends it here; we
 * store anything the webhook didn't deliver (same parser, deduplicated on the Nexconn id).
 * Agency members only, and only for their project's client room.
 */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Invalid request.");
  try {
    const res = await routeProjectAccess(input.projectId);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Project not found.");
    if (res.access.kind !== "member") return jsonError(403, "Only your agency team can sync messages.");
    const limited = await rateLimit(req, "messages-sync", LIMITS.write, res.access.userId);
    if (limited) return limited;
    const project = res.access.project;
    if (!project.client_channel_id) return ok({ stored: 0 });

    let stored = 0;
    for (const m of input.messages) {
      const parsed = parseWebhookMessage({
        userId: m.senderUserId,
        channelId: project.client_channel_id,
        messageType: m.messageType,
        content: JSON.stringify(toWire(m.messageType, m.content)),
        channelType: 3,
        time: m.sentTime,
        messageId: m.messageId,
      });
      if (!parsed) continue;
      const r = await storeMessage(project, parsed);
      if (!r.inserted) continue;
      stored++;
      if (parsed.kind === "voice" && parsed.voiceRemoteUrl) {
        const id = parsed.nexconnMsgId;
        const remote = parsed.voiceRemoteUrl;
        const ownPath = /\/api\/voice\/([0-9a-f-]{36})/.exec(remote)?.[1];
        after(() =>
          runJob("transcribe", { msg: id.slice(0, 64) }, () =>
            transcribeVoice({ nexconnMsgId: id, storagePath: ownPath ? undefined : null, remoteUrl: ownPath ? null : remote }),
          ),
        );
      }
    }
    if (stored) console.info(`[sync] stored=${stored} of ${input.messages.length}`);
    return ok({ stored });
  } catch (err) {
    return handleRouteError("messages/sync", err);
  }
}
