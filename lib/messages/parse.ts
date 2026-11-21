/**
 * Turns a Nexconn `message:send` webhook item into what we store (pure, unit-tested).
 * Formats: docs platform-chat-api/webhook/message/send.md and message-about/objectname.md.
 */

export interface WebhookMessage {
  userId: string;
  channelId: string;
  messageType: string;
  content: string;
  channelType: number;
  time: number;
  messageId: string;
}

export interface ParsedMessage {
  nexconnMsgId: string;
  channelId: string;
  authorId: string;
  kind: "text" | "voice" | "image" | "file" | "card" | "other";
  text: string | null;
  replyToText: string | null;
  voiceRemoteUrl: string | null;
  voiceDuration: number | null;
  sentAt: string;
}

function json(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
const str = (v: unknown) => (typeof v === "string" ? v : null);

export function parseWebhookMessage(m: WebhookMessage): ParsedMessage | null {
  if (m.channelType !== 3 || !m.messageId || !m.channelId || !m.userId) return null; // group channels only
  const c = json(m.content);
  const base = {
    nexconnMsgId: m.messageId,
    channelId: m.channelId,
    authorId: m.userId,
    sentAt: new Date(Number.isFinite(m.time) ? m.time : Date.now()).toISOString(),
    replyToText: null as string | null,
    voiceRemoteUrl: null as string | null,
    voiceDuration: null as number | null,
  };
  switch (m.messageType) {
    case "RC:TxtMsg":
      return { ...base, kind: "text", text: str(c.content) };
    case "RC:ReferenceMsg": {
      const refer = (c.referMsg ?? {}) as Record<string, unknown>;
      return { ...base, kind: "text", text: str(c.content), replyToText: str(refer.content) };
    }
    case "RC:HQVCMsg":
    case "RC:VcMsg":
      return {
        ...base,
        kind: "voice",
        text: null,
        voiceRemoteUrl: str(c.remoteUrl),
        voiceDuration: typeof c.duration === "number" ? c.duration : null,
      };
    case "RC:ImgMsg":
    case "RC:GIFMsg":
      return { ...base, kind: "image", text: null };
    case "RC:FileMsg":
      return { ...base, kind: "file", text: str(c.name) };
    default:
      if (m.messageType.startsWith("drifty:")) return { ...base, kind: "card", text: null };
      return null; // receipts, status and system messages aren't feedback
  }
}

/** Replay protection for webhooks: reject timestamps more than 5 minutes off. */
export function isFreshTimestamp(ts: string | null, now: number = Date.now(), windowMs = 5 * 60 * 1000): boolean {
  const n = Number(ts);
  return Number.isFinite(n) && Math.abs(now - n) <= windowMs;
}
