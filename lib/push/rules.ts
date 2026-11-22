import { z } from "zod";

/**
 * Push notification copy (pure, unit-tested). Notifications never carry message contents:
 * they say who did what and link to the room, so nothing private sits on a lock screen.
 */

export const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});
export type PushSubscriptionInput = z.infer<typeof subscriptionSchema>;

export type PushEvent =
  | { type: "feedback"; projectId: string; clientName: string; authorName: string }
  | { type: "reply"; projectId: string; clientName: string }
  | { type: "version"; projectId: string; title: string; number: number }
  | { type: "approved"; projectId: string; clientName: string; authorName: string; title: string; number: number }
  | { type: "changes"; projectId: string; clientName: string; authorName: string; title: string; number: number };

export interface PushPayload {
  title: string;
  body: string;
  /** Same-origin path the notification opens. */
  url: string;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag: string;
}

const clip = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function pushCopy(e: PushEvent): PushPayload {
  const team = `/app/projects/${e.projectId}`;
  switch (e.type) {
    case "feedback":
      return { title: `New feedback · ${clip(e.clientName)}`, body: `${clip(e.authorName)} sent a message in the client room.`, url: team, tag: `feedback-${e.projectId}` };
    case "reply":
      return { title: "New message from your agency", body: `There's a new message in your ${clip(e.clientName)} room.`, url: `/room/${e.projectId}`, tag: `reply-${e.projectId}` };
    case "version":
      return { title: "Ready for your review", body: `${clip(e.title)} v${e.number} is waiting for you.`, url: `/room/${e.projectId}`, tag: `version-${e.projectId}` };
    case "approved":
      return { title: `Approved · ${clip(e.clientName)}`, body: `${clip(e.authorName)} approved ${clip(e.title)} v${e.number}.`, url: team, tag: `approval-${e.projectId}-${e.number}` };
    case "changes":
      return { title: `Changes requested · ${clip(e.clientName)}`, body: `${clip(e.authorName)} asked for changes on ${clip(e.title)} v${e.number}.`, url: team, tag: `changes-${e.projectId}-${e.number}` };
  }
}

/** Chat messages notify at most once per project and direction in this window (seconds). */
export const CHAT_PUSH_WINDOW_SEC = 300;
