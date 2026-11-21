import "server-only";
import { nexconnEnv } from "@/lib/env";
import { signedHeaders } from "./sign";

/**
 * Thin client for the Nexconn Platform Chat API (v4, JSON).
 * Endpoints and fields are taken from docs.nexconn.ai (see docs/PROGRESS.md decision record).
 * Never log request bodies: they can contain message contents.
 */

export class NexconnApiError extends Error {
  constructor(
    public readonly path: string,
    public readonly code: number | null,
    public readonly httpStatus: number,
  ) {
    super(`Nexconn API ${path} failed (code ${code ?? "n/a"}, http ${httpStatus})`);
    this.name = "NexconnApiError";
  }
}

interface ApiResponse<T> {
  code: number;
  result?: T;
  [k: string]: unknown;
}

const TIMEOUT_MS = 5000;

function backupHost(host: string): string | null {
  // Docs: each region has a primary "api." and a backup "api-b." domain.
  return host.startsWith("api.") ? `api-b.${host.slice(4)}` : null;
}

async function call<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const env = nexconnEnv();
  const primary = env.NEXCONN_API_BASE.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const hosts = [primary, backupHost(primary)].filter((h): h is string => Boolean(h));

  let lastError: unknown;
  for (const host of hosts) {
    try {
      const res = await fetch(`https://${host}${path}`, {
        method: "POST",
        headers: {
          ...signedHeaders(env.NEXT_PUBLIC_NEXCONN_APP_KEY, env.NEXCONN_APP_SECRET),
          "Content-Type": "application/json",
          "X-Request-ID": crypto.randomUUID().replace(/-/g, ""),
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Unexpected HTTP status → try the backup host (docs: domain failover).
      if (res.status >= 500) {
        lastError = new NexconnApiError(path, null, res.status);
        continue;
      }
      const json = (await res.json()) as ApiResponse<T>;
      if (!res.ok || json.code !== 0) {
        throw new NexconnApiError(path, typeof json.code === "number" ? json.code : null, res.status);
      }
      return json;
    } catch (err) {
      if (err instanceof NexconnApiError && err.httpStatus < 500) throw err;
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new NexconnApiError(path, null, 0);
}

/** POST /v4/auth/access-token/issue: registers the user on first call. */
export async function issueAccessToken(userId: string, name: string, avatarUrl?: string) {
  const res = await call<{ accessToken: string; userId: string }>("/v4/auth/access-token/issue", {
    userId,
    name: name.slice(0, 64),
    ...(avatarUrl ? { avatarUrl } : {}),
  });
  if (!res.result?.accessToken) throw new NexconnApiError("/v4/auth/access-token/issue", res.code, 200);
  return res.result.accessToken;
}

/** POST /v4/group-channel/create (owner auto-joins; userIds max 30). */
export async function createGroupChannel(channelId: string, name: string, owner: string, userIds: string[] = []) {
  await call("/v4/group-channel/create", {
    channelId,
    name: name.slice(0, 64),
    owner,
    userIds: userIds.slice(0, 30),
  });
}

/** POST /v4/group-channel/join (max 100 per request). */
export async function joinGroupChannel(channelId: string, userIds: string[]) {
  await call("/v4/group-channel/join", { channelId, userIds: userIds.slice(0, 100) });
}

/** POST /v4/group-channel/leave: remove users from a group channel (max 100). */
export async function leaveGroupChannel(channelId: string, userIds: string[]) {
  await call("/v4/group-channel/leave", { channelId, userIds: userIds.slice(0, 100) });
}

export interface SendGroupMessageInput {
  fromUserId: string;
  channelId: string;
  messageType: string;
  content: Record<string, unknown>;
  pushContent?: string;
  metadata?: Record<string, string>;
  /** Also deliver to the sender's own devices (needed when we send on a user's behalf). */
  echoToSender?: boolean;
}

/** POST /v4/group-channel/message/send. Returns the Nexconn message id. */
export async function sendGroupMessage(input: SendGroupMessageInput): Promise<string> {
  const res = await call<{ messageIds: { channelId: string; messageId: string }[] }>(
    "/v4/group-channel/message/send",
    {
      fromUserId: input.fromUserId,
      toChannelIds: [input.channelId],
      messageType: input.messageType,
      content: JSON.stringify(input.content),
      ...(input.pushContent ? { pushContent: input.pushContent } : {}),
      shouldPersist: 1,
      isEchoToSender: input.echoToSender ? 1 : 0,
      ...(input.metadata ? { hasMetadata: true, metadata: input.metadata } : {}),
    },
  );
  const id = res.result?.messageIds?.[0]?.messageId;
  if (!id) throw new NexconnApiError("/v4/group-channel/message/send", res.code, 200);
  return id;
}

/** POST /v4/channel-type/message/metadata/set (group = channelType 3). */
export async function setGroupMessageMetadata(input: {
  messageId: string;
  operatorUserId: string;
  channelId: string;
  metadata: Record<string, string>;
}) {
  await call("/v4/channel-type/message/metadata/set", {
    messageId: input.messageId,
    userId: input.operatorUserId,
    channelType: 3,
    channelId: input.channelId,
    metadata: input.metadata,
    isEchoToSender: 1,
  });
}
