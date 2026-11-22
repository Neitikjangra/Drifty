import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Project } from "@/lib/db/types";
import { appUrl } from "@/lib/env";
import { CHAT_PUSH_WINDOW_SEC, pushCopy, type PushEvent, type PushSubscriptionInput } from "./rules";

const clean = (v: string | undefined) => v?.trim().replace(/^"(.*)"$/, "$1") ?? "";

/** True when VAPID keys are set; without them push is simply off (no errors). */
export function pushConfigured(): boolean {
  return Boolean(clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) && clean(process.env.VAPID_PRIVATE_KEY));
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (!pushConfigured()) return false;
  if (!vapidReady) {
    const subject = clean(process.env.VAPID_SUBJECT) || appUrl();
    webpush.setVapidDetails(subject.startsWith("http") || subject.startsWith("mailto:") ? subject : `mailto:${subject}`, clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY), clean(process.env.VAPID_PRIVATE_KEY));
    vapidReady = true;
  }
  return true;
}

export async function saveSubscription(userId: string, sub: PushSubscriptionInput): Promise<void> {
  // An endpoint belongs to one browser; if someone else signs in on it, it moves to them.
  const { error } = await supabaseAdmin()
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
  if (error) throw new Error(`saveSubscription ${error.code ?? ""}`);
}

export async function deleteSubscription(userId: string, endpoint: string): Promise<void> {
  const { error } = await supabaseAdmin().from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
  if (error) throw new Error(`deleteSubscription ${error.code ?? ""}`);
}

/** Sends to every device of these people; drops subscriptions the push service says are gone. */
export async function sendToUsers(userIds: string[], event: PushEvent): Promise<number> {
  if (!userIds.length || !ensureVapid()) return 0;
  const db = supabaseAdmin();
  const { data, error } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", [...new Set(userIds)]).limit(200);
  if (error || !data?.length) return 0;
  const payload = JSON.stringify(pushCopy(event));
  let sent = 0;
  await Promise.all(
    (data as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, timeout: 8000 });
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        else console.warn(`[push] send failed (${code ?? "network"})`);
      }
    }),
  );
  return sent;
}

/** Owner/AM user ids of the project's agency (the people in the client room), minus one. */
export async function teamUserIds(project: Project, except?: string): Promise<string[]> {
  const { data } = await supabaseAdmin().from("members").select("user_id").eq("workspace_id", project.workspace_id).in("role", ["owner", "am"]);
  return ((data ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((id) => id !== except);
}

export async function clientUserIds(project: Project, except?: string): Promise<string[]> {
  const { data } = await supabaseAdmin().from("project_guests").select("user_id").eq("project_id", project.id);
  return ((data ?? []) as { user_id: string }[]).map((g) => g.user_id).filter((id) => id !== except);
}

/** One chat notification per project and direction per window, so a burst of messages is one buzz. */
async function chatWindowOpen(key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", { p_key: key, p_limit: 1, p_window_seconds: CHAT_PUSH_WINDOW_SEC });
  return !error && data === true;
}

/**
 * A text or voice message landed in the client room: a client's message tells the team,
 * a team message tells the client. Bot messages and cards don't notify.
 */
export async function notifyRoomMessage(project: Project, channelId: string, authorNexconnId: string): Promise<void> {
  if (!pushConfigured() || channelId !== project.client_channel_id) return;
  const db = supabaseAdmin();
  const { data: author } = await db.from("profiles").select("user_id, display_name").eq("nexconn_user_id", authorNexconnId).maybeSingle();
  if (!author) return;
  const a = author as { user_id: string; display_name: string };
  const { data: guest } = await db.from("project_guests").select("user_id").eq("project_id", project.id).eq("user_id", a.user_id).maybeSingle();
  if (guest) {
    if (!(await chatWindowOpen(`push:feedback:${project.id}`))) return;
    await sendToUsers(await teamUserIds(project), { type: "feedback", projectId: project.id, clientName: project.client_name, authorName: a.display_name });
  } else {
    if (!(await chatWindowOpen(`push:reply:${project.id}`))) return;
    await sendToUsers(await clientUserIds(project), { type: "reply", projectId: project.id, clientName: project.client_name });
  }
}

/** A version was posted to the client room. */
export async function notifyNewVersion(project: Project, title: string, number: number): Promise<void> {
  if (!pushConfigured()) return;
  await sendToUsers(await clientUserIds(project), { type: "version", projectId: project.id, title, number });
}

/** The approver approved or asked for changes. */
export async function notifyDecision(
  project: Project,
  kind: "approved" | "changes",
  who: { userId: string; name: string },
  title: string,
  number: number,
): Promise<void> {
  if (!pushConfigured()) return;
  await sendToUsers(await teamUserIds(project, who.userId), { type: kind, projectId: project.id, clientName: project.client_name, authorName: who.name, title, number });
}
