// End-to-end check of Round 3 (webhook ingestion, voice, AI change list, conflicts) against a
// LOCAL server. Webhook calls are signed exactly like Nexconn (sha1(AppSecret+Nonce+Timestamp)).
// Uses real Gemini. Fixed test agency e2e-r3@drifty.test.
// Usage: node scripts/e2e-round3.mjs [http://localhost:3101]
import { createHash, randomInt } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
const BASE = (process.argv[2] ?? "http://localhost:3101").replace(/\/+$/, "");
if (!/^http:\/\/localhost(:\d+)?$/.test(BASE)) {
  console.error("This test only runs against localhost.");
  process.exit(1);
}
const strip = (v) => v?.trim().replace(/^"(.*)"$/, "$1");
const URL_ = strip(process.env.NEXT_PUBLIC_SUPABASE_URL);
const APP_KEY = strip(process.env.NEXT_PUBLIC_NEXCONN_APP_KEY);
const SECRET = strip(process.env.NEXCONN_APP_SECRET);
const admin = createClient(URL_, strip(process.env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false } });
const anon = createClient(URL_, strip(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), { auth: { persistSession: false } });

class Browser {
  constructor() {
    this.jar = new Map();
  }
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (!v || /max-age=0/i.test(c)) this.jar.delete(k);
      else this.jar.set(k, v);
    }
  }
  async req(path, { method = "GET", body, form, follow = false, headers = {} } = {}) {
    let url = path.startsWith("http") ? path : BASE + path;
    for (let hops = 0; hops < 6; hops++) {
      const res = await fetch(url, {
        method,
        redirect: "manual",
        headers: { cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "), ...(body ? { "content-type": "application/json" } : {}), ...headers },
        body: form ?? (body ? JSON.stringify(body) : undefined),
      });
      this.store(res);
      const loc = res.headers.get("location");
      if (follow && loc && res.status >= 300 && res.status < 400 && new URL(loc, url).origin === BASE) {
        url = new URL(loc, url).toString();
        method = "GET";
        body = undefined;
        continue;
      }
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: res.status, json, text, url };
    }
    throw new Error("too many redirects");
  }
}

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  →  ${detail}` : ""}`);
}
async function signIn(b, email) {
  let { data } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (data.properties.verification_type !== "magiclink") ({ data } = await admin.auth.admin.generateLink({ type: "magiclink", email }));
  return b.req(`/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/app`, { follow: true });
}
function webhook(body, { badSig = false, ts = Date.now() } = {}) {
  const nonce = String(randomInt(1, 2 ** 40));
  const timestamp = String(ts);
  const sig = createHash("sha1").update(SECRET + nonce + timestamp).digest("hex");
  return fetch(`${BASE}/api/nexconn/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", AppKey: APP_KEY, Nonce: nonce, Timestamp: timestamp, Signature: badSig ? "0".repeat(40) : sig },
    body: JSON.stringify(body),
  });
}
const msgEvent = (userId, channelId, text, id) => ({
  type: "message:send",
  id: `evt-${id}`,
  time: Date.now(),
  data: [{ userId, channelId, messageType: "RC:TxtMsg", content: JSON.stringify({ content: text }), channelType: 3, time: Date.now(), messageId: id, os: "Websocket" }],
});
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
function silentWav(seconds = 1) {
  const sr = 8000, n = sr * seconds, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

const stamp = Date.now().toString(36);
const am = new Browser(), approver = new Browser(), reviewer = new Browser(), stranger = new Browser();
console.log(`E2E Round 3 against ${BASE}\n`);

// Setup
await signIn(am, "e2e-r3@drifty.test");
await am.req("/api/onboarding", { method: "POST", body: { workspaceName: "E2E Round 3 Agency (test)", displayName: "R3 AM" } });
const proj = await am.req("/api/projects", { method: "POST", body: { clientName: `R3 Diwali ${stamp}` } });
const projectId = proj.json?.id;
check("setup: project", proj.status === 201, proj.text.slice(0, 120));
const { data: p } = await admin.from("projects").select("client_channel_id, internal_channel_id").eq("id", projectId).single();
const invA = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "priya@r3.test", name: "Priya", role: "approver" } });
const invR = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "rahul@r3.test", name: "Rahul", role: "reviewer" } });
await approver.req(`/api/join/${invA.json.link.split("/join/")[1]}`, { method: "POST", body: { name: "Priya" } });
await reviewer.req(`/api/join/${invR.json.link.split("/join/")[1]}`, { method: "POST", body: { name: "Rahul" } });
const { data: guests } = await admin.from("project_guests").select("role, profiles(nexconn_user_id)").eq("project_id", projectId);
const priyaId = guests.find((g) => g.role === "approver").profiles.nexconn_user_id;
const rahulId = guests.find((g) => g.role === "reviewer").profiles.nexconn_user_id;
const slot = await am.req("/api/uploads", { method: "POST", body: { projectId, contentType: "image/png", size: PNG.length } });
await anon.storage.from("deliverables").uploadToSignedUrl(slot.json.path, slot.json.token, PNG, { contentType: "image/png" });
const del = await am.req("/api/deliverables", { method: "POST", body: { projectId, title: "Diwali post 1", copy: "Light up your Diwali. Buy now.", assetPath: slot.json.path } });
const dId = del.json?.id;
check("setup: deliverable v1 posted", del.status === 201, del.text.slice(0, 120));
await new Promise((r) => setTimeout(r, 1200)); // messages must be after v1

// Summarise with no feedback yet → helpful 400
const empty = await am.req(`/api/deliverables/${dId}/summarise`, { method: "POST" });
check("summarise with no client feedback explains why", empty.status === 400 && /No client feedback/.test(empty.json?.error ?? ""), `${empty.status} ${empty.text.slice(0, 120)}`);

// FR-8 input: webhook
const m1 = `R3-${stamp}-1`, m2 = `R3-${stamp}-2`, m3 = `R3-${stamp}-3`;
const bad = await webhook(msgEvent(priyaId, p.client_channel_id, "forged", `R3-${stamp}-x`), { badSig: true });
check("webhook rejects a bad signature", bad.status === 401, `${bad.status}`);
const stale = await webhook(msgEvent(priyaId, p.client_channel_id, "old", `R3-${stamp}-y`), { ts: Date.now() - 10 * 60_000 });
check("webhook rejects a stale timestamp (replay)", stale.status === 401, `${stale.status}`);
const w1 = await webhook(msgEvent(priyaId, p.client_channel_id, "Please make the logo bigger, it's too small.", m1));
await webhook(msgEvent(rahulId, p.client_channel_id, "Logo should be smaller. Also change the CTA from 'Buy now' to 'Shop the sale'.", m2));
await webhook(msgEvent(priyaId, p.client_channel_id, "Thanks team!", m3));
check("webhook accepts a signed event", w1.status === 200, `${w1.status}`);
const dup = await webhook(msgEvent(priyaId, p.client_channel_id, "Please make the logo bigger, it's too small.", m1));
check("webhook is idempotent (duplicate stored once)", dup.status === 200 && (await dup.json()).stored === 0);
const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("nexconn_msg_id", [m1, m2, m3]);
check("3 client messages stored", count === 3, `${count}`);
const other = await webhook({ type: "user:connection_status", id: "x", time: Date.now(), data: [{ status: "0", userId: "u", os: "iOS", time: Date.now() }] });
check("other webhook events are acknowledged", other.status === 200);

// FR-7: voice note (recorded in Drifty)
const fd = new FormData();
fd.set("projectId", projectId);
fd.set("channelId", p.client_channel_id);
fd.set("duration", "1");
fd.set("file", new File([silentWav(1)], "voice.wav", { type: "audio/wav" }));
const voice = await approver.req("/api/voice", { method: "POST", form: fd });
check("client sends a voice note (posted to Nexconn)", voice.status === 201 && Boolean(voice.json?.messageId), `${voice.status} ${voice.text.slice(0, 160)}`);
const fdBad = new FormData();
fdBad.set("projectId", projectId);
fdBad.set("channelId", p.internal_channel_id);
fdBad.set("duration", "1");
fdBad.set("file", new File([silentWav(1)], "voice.wav", { type: "audio/wav" }));
check("client can't post voice into the internal room", (await approver.req("/api/voice", { method: "POST", form: fdBad })).status === 403);
const { data: vrow } = await admin.from("messages").select("voice_url").eq("nexconn_msg_id", voice.json?.messageId).single();
const vid = /\/([0-9a-f-]{36})\./.exec(vrow?.voice_url ?? "")?.[1];
const play = await reviewer.req(`/api/voice/${vid}`);
check("room member can play the voice note (signed URL)", play.status === 302, `${play.status}`);
check("anonymous can't play it", (await stranger.req(`/api/voice/${vid}`)).status === 401);
let transcript = null;
for (let i = 0; i < 40 && !transcript; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  transcript = (await admin.from("messages").select("transcript").eq("nexconn_msg_id", voice.json.messageId).single()).data?.transcript;
}
check("voice note gets a transcript (Gemini)", Boolean(transcript), "no transcript after 40 s");

// FR-8 + FR-12: summarise
check("clients can't summarise", (await approver.req(`/api/deliverables/${dId}/summarise`, { method: "POST" })).status === 403);
const t0 = Date.now();
const sum = await am.req(`/api/deliverables/${dId}/summarise`, { method: "POST" });
const ms = Date.now() - t0;
check("AM summarises → change list", sum.status === 201 && sum.json?.items >= 2, `${sum.status} ${sum.text.slice(0, 200)}`);
check(`change list within 15 s (NFR-1): ${ms} ms`, ms <= 15_000, `${ms} ms`);
const { data: items } = await admin.from("change_items").select("id, text, type, status, source_msg_ids, author_ids, position").eq("change_list_id", sum.json?.changeListId).order("position");
check("every item links to a source message", items?.length > 0 && items.every((i) => i.source_msg_ids.length > 0 && i.source_msg_ids.every((s) => [m1, m2, m3, voice.json?.messageId].includes(s))), JSON.stringify(items?.map((i) => i.source_msg_ids)));
check("'Thanks team!' didn't become a change", !items?.some((i) => i.source_msg_ids.length === 1 && i.source_msg_ids[0] === m3));
check("AI never confirms: all items start Suggested", items?.every((i) => i.status === "suggested"));
const { data: cl } = await admin.from("change_lists").select("card_message_id").eq("id", sum.json?.changeListId).single();
check("change list card posted in the internal room", Boolean(cl?.card_message_id));
const { data: conflicts } = await admin.from("drift_alerts").select("id, card_message_id, detail").eq("deliverable_id", dId).eq("kind", "feedback");
check("conflict (logo bigger vs smaller) detected", sum.json?.conflicts >= 1 && conflicts?.length >= 1, `conflicts=${sum.json?.conflicts}`);
check("conflict card posted in the client room", Boolean(conflicts?.[0]?.card_message_id));

// FR-9: confirm / edit / reject
const cta = items.find((i) => /cta|shop/i.test(i.text)) ?? items[items.length - 1];
check("clients can't confirm items", (await approver.req(`/api/changes/${cta.id}`, { method: "PATCH", body: { action: "confirm" } })).status === 403);
const ed = await am.req(`/api/changes/${cta.id}`, { method: "PATCH", body: { action: "edit", text: "Change the CTA to 'Shop the sale'" } });
check("AM edits an item (edit also confirms)", ed.status === 200 && ed.json?.status === "confirmed", `${ed.status}`);
const { data: edited } = await admin.from("change_items").select("text, status").eq("id", cta.id).single();
check("edited text saved", edited?.text === "Change the CTA to 'Shop the sale'" && edited.status === "confirmed");

// FR-12: approver resolves the conflict
const conflict = conflicts[0];
check("reviewer can't decide the conflict", (await reviewer.req(`/api/conflicts/${conflict.id}/resolve`, { method: "POST", body: { choice: "a" } })).status === 403);
check("AM can't decide for the client", (await am.req(`/api/conflicts/${conflict.id}/resolve`, { method: "POST", body: { choice: "a" } })).status === 403);
const res = await approver.req(`/api/conflicts/${conflict.id}/resolve`, { method: "POST", body: { choice: "a" } });
check("approver chooses option A", res.status === 200, `${res.status} ${res.text.slice(0, 120)}`);
const again = await approver.req(`/api/conflicts/${conflict.id}/resolve`, { method: "POST", body: { choice: "b" } });
check("decision can't be changed twice", again.status === 409, `${again.status}`);
const { data: pair } = await admin.from("change_items").select("id, status").in("id", [conflict.detail.itemA, conflict.detail.itemB]);
const a = pair.find((x) => x.id === conflict.detail.itemA), b = pair.find((x) => x.id === conflict.detail.itemB);
check("chosen option confirmed, the other rejected", a?.status === "confirmed" && b?.status === "rejected", JSON.stringify(pair));

// Brief
const rej = items.find((i) => i.id !== cta.id && i.id !== conflict.detail.itemA && i.id !== conflict.detail.itemB);
if (rej) check("AM rejects an item", (await am.req(`/api/changes/${rej.id}`, { method: "PATCH", body: { action: "reject" } })).status === 200);
const brief = await am.req(`/api/changelists/${sum.json.changeListId}/brief`, { method: "POST" });
check("AM sends the brief (confirmed items)", brief.status === 200 && brief.json?.sent >= 2, `${brief.status} ${brief.text.slice(0, 120)}`);
check("clients can't send the brief", (await approver.req(`/api/changelists/${sum.json.changeListId}/brief`, { method: "POST" })).status === 403);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
