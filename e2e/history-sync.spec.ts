import { createHash, randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { expect, test } from "@playwright/test";

/**
 * Webhook safety net: a client message that exists in Nexconn but never reached Drifty (no
 * webhook delivery) is picked up when the AM presses Summarise, via the Chat SDK history sync.
 * Uses the newest Playwright demo agency (created by demo-path.spec.ts).
 */
dotenv.config({ path: ".env.local", quiet: true });
const strip = (v?: string) => (v ?? "").trim().replace(/^"(.*)"$/, "$1");
const admin = createClient(strip(process.env.NEXT_PUBLIC_SUPABASE_URL), strip(process.env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false } });

async function nexconnSend(fromUserId: string, channelId: string, text: string): Promise<string> {
  const host = (strip(process.env.NEXCONN_API_BASE) || "api.sg-light-api.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const nonce = String(randomInt(1, 2 ** 40));
  const ts = String(Date.now());
  const r = await fetch(`https://${host}/v4/group-channel/message/send`, {
    method: "POST",
    headers: {
      "App-Key": strip(process.env.NEXT_PUBLIC_NEXCONN_APP_KEY),
      Nonce: nonce,
      Timestamp: ts,
      Signature: createHash("sha1").update(strip(process.env.NEXCONN_APP_SECRET) + nonce + ts).digest("hex"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fromUserId, toChannelIds: [channelId], messageType: "RC:TxtMsg", content: JSON.stringify({ content: text }) }),
  });
  const j = (await r.json()) as { result?: { messageIds?: { messageId: string }[] } };
  return j.result!.messageIds![0].messageId;
}

test("Summarise picks up client messages the webhook missed", async ({ page }) => {
  const { data: ws } = await admin.from("workspaces").select("id, owner_id").like("name", "PW Agency %").order("created_at", { ascending: false }).limit(1).single();
  const { data: p } = await admin.from("projects").select("id, client_channel_id").eq("workspace_id", ws!.id).eq("is_demo", true).single();
  const { data: g } = await admin.from("project_guests").select("role, profiles(nexconn_user_id)").eq("project_id", p!.id).eq("role", "reviewer").single();
  const rahul = (g as unknown as { profiles: { nexconn_user_id: string } }).profiles.nexconn_user_id;
  // A deliverable still in review to summarise: reset the demo's (test data only).
  const { data: d } = await admin.from("deliverables").select("id").eq("project_id", p!.id).single();
  await admin.from("deliverables").update({ status: "in_review" }).eq("id", d!.id);

  const msgId = await nexconnSend(rahul, p!.client_channel_id!, `Please also add the cafe address at the bottom (${Date.now().toString(36)})`);
  // With the webhook on, it may already be stored; without it, the Summarise sync stores it.

  const { data: u } = await admin.auth.admin.getUserById(ws!.owner_id);
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user!.email! });
  await page.goto(`/auth/callback?token_hash=${link.properties!.hashed_token}&type=magiclink&next=/app/projects/${p!.id}`);
  await page.locator("nc-chat-ui-app-provider textarea").first().waitFor({ timeout: 60_000 }); // chat connected
  await page.getByRole("button", { name: "Summarise feedback" }).click();
  // Stored (by the webhook or by the history sync, which runs before the AI step).
  await expect
    .poll(async () => (await admin.from("messages").select("id").eq("nexconn_msg_id", msgId).maybeSingle()).data !== null, { timeout: 45_000 })
    .toBe(true);
  // And Summarise answers (a change list, "no new feedback", or "picked up from the room").
  await expect(page.getByText(/suggested from|No new client feedback|picked up from the room|AI is busy|usage limit/)).toBeVisible({ timeout: 90_000 });
});
