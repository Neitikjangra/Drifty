// End-to-end check of Round 4 (drift check AI-3, ledger + CSV, dashboard) against a LOCAL server.
// Uses real Gemini + Nexconn. Fixed test agency e2e-r4@drifty.test.
// Usage: node scripts/e2e-round4.mjs [http://localhost:3101]
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

const stamp = Date.now().toString(36);
const am = new Browser(), approver = new Browser(), reviewer = new Browser(), stranger = new Browser();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
console.log(`E2E Round 4 against ${BASE}\n`);

let projectId = null;
async function uploadPng() {
  const slot = await am.req("/api/uploads", { method: "POST", body: { projectId, contentType: "image/png", size: PNG.length } });
  await anon.storage.from("deliverables").uploadToSignedUrl(slot.json.path, slot.json.token, PNG, { contentType: "image/png" });
  return slot.json.path;
}
async function waitForCard(alertId, seconds = 75) {
  for (let i = 0; i < seconds; i++) {
    const { data } = await admin.from("drift_alerts").select("card_message_id, detail").eq("id", alertId).single();
    if (data?.card_message_id) return data;
    await sleep(1000);
  }
  return null;
}
const verdictOf = (results, id) => results.find((r) => r.itemId === id)?.verdict;

// Setup: project, approver + reviewer, v1, two copy requests confirmed by the AM
await signIn(am, "e2e-r4@drifty.test");
await am.req("/api/onboarding", { method: "POST", body: { workspaceName: "E2E Round 4 Agency (test)", displayName: "R4 AM" } });
await admin.from("workspaces").update({ plan: "pilot" }).eq("name", "E2E Round 4 Agency (test)"); // test agency: no Free-plan client limit
const proj = await am.req("/api/projects", { method: "POST", body: { clientName: `R4 Diwali ${stamp}` } });
projectId = proj.json?.id;
check("setup: project", proj.status === 201, proj.text.slice(0, 120));
const { data: p } = await admin.from("projects").select("client_channel_id, internal_channel_id").eq("id", projectId).single();
const invA = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "priya@r4.test", name: "Priya", role: "approver" } });
const invR = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "rahul@r4.test", name: "Rahul", role: "reviewer" } });
await approver.req(`/api/join/${invA.json.link.split("/join/")[1]}`, { method: "POST", body: { name: "Priya" } });
await reviewer.req(`/api/join/${invR.json.link.split("/join/")[1]}`, { method: "POST", body: { name: "Rahul" } });
const { data: guests } = await admin.from("project_guests").select("role, user_id, profiles(nexconn_user_id)").eq("project_id", projectId);
const priya = guests.find((g) => g.role === "approver");
const priyaId = priya.profiles.nexconn_user_id;
const del = await am.req("/api/deliverables", { method: "POST", body: { projectId, title: "Diwali post", copy: "Light up your Diwali. Buy now.", assetPath: await uploadPng() } });
const dId = del.json?.id;
check("setup: deliverable v1 posted", del.status === 201, del.text.slice(0, 120));
await sleep(1200);
await webhook(msgEvent(priyaId, p.client_channel_id, "Please change the CTA from 'Buy now' to 'Shop the sale'.", `R4-${stamp}-1`));
await webhook(msgEvent(priyaId, p.client_channel_id, "And add 'Free delivery' at the end of the caption.", `R4-${stamp}-2`));
let sum = null;
for (let i = 0; i < 3; i++) {
  sum = await am.req(`/api/deliverables/${dId}/summarise`, { method: "POST" });
  if (sum.status === 201) break;
  await sleep(8000);
}
check("setup: change list", sum.status === 201 && sum.json.items >= 2, `${sum.status} ${sum.text.slice(0, 160)}`);
const { data: items } = await admin.from("change_items").select("id, text").eq("change_list_id", sum.json?.changeListId);
for (const it of items ?? []) await am.req(`/api/changes/${it.id}`, { method: "PATCH", body: { action: "confirm" } });
const cta = (items ?? []).find((i) => /shop|cta/i.test(i.text));
const free = (items ?? []).find((i) => /free delivery/i.test(i.text));
check("setup: both requests confirmed", Boolean(cta && free), JSON.stringify(items?.map((i) => i.text)));

// FR-11: v2 ignores the CTA change → held, drift card names it
const up2 = await am.req(`/api/deliverables/${dId}/versions`, { method: "POST", body: { copy: "Light up your Diwali. Buy now. Free delivery.", assetPath: await uploadPng() } });
check("v2 upload is held for the drift check", up2.status === 201 && up2.json?.held === true && up2.json?.checking >= 2, `${up2.status} ${up2.text.slice(0, 160)}`);
const v2 = up2.json?.versionId;
const { data: d2 } = await admin.from("deliverables").select("status, current_version").eq("id", dId).single();
check("deliverable is 'draft' (held) at v2", d2?.status === "draft" && d2?.current_version === 2, JSON.stringify(d2));
const { data: v2row } = await admin.from("versions").select("card_message_id").eq("id", v2).single();
check("no card in the client room for held v2", v2row?.card_message_id === null);
check("client can't open the held file", (await approver.req(`/api/assets/${v2}`)).status === 404);
check("team can open the held file", (await am.req(`/api/assets/${v2}`)).status === 302);
const { data: v1row } = await admin.from("versions").select("id").eq("deliverable_id", dId).eq("number", 1).single();
const appr1 = await approver.req(`/api/versions/${v1row.id}/approve`, { method: "POST" });
check("approver can't approve while a version is held", appr1.status === 409 && /preparing/i.test(appr1.json?.error ?? ""), `${appr1.status} ${appr1.text.slice(0, 120)}`);
check("summarise waits while held", (await am.req(`/api/deliverables/${dId}/summarise`, { method: "POST" })).status === 409);

const t0 = Date.now();
const a2 = await waitForCard(up2.json?.alertId);
check(`drift card posted in the internal room (${Math.round((Date.now() - t0) / 1000)} s)`, Boolean(a2), "no card after 75 s");
const res2 = a2?.detail?.results ?? [];
check("AI ran (not the 'check by eye' fallback)", a2?.detail?.aiChecked === true, JSON.stringify(a2?.detail));
check("CTA change flagged missing", verdictOf(res2, cta?.id) === "missing", JSON.stringify(res2));
check("'Free delivery' marked done", verdictOf(res2, free?.id) === "done", JSON.stringify(res2));
const { data: ctaRow } = await admin.from("change_items").select("status").eq("id", cta?.id).single();
check("verdict recorded on the change item", ctaRow?.status === "missing", ctaRow?.status);

// Decisions: owner/AM only, once
const alert2 = up2.json?.alertId;
check("client can't decide", [401, 403, 404].includes((await approver.req(`/api/drift/${alert2}`, { method: "POST", body: { action: "send" } })).status));
check("anonymous can't decide", (await stranger.req(`/api/drift/${alert2}`, { method: "POST", body: { action: "back" } })).status === 401);
const back = await am.req(`/api/drift/${alert2}`, { method: "POST", body: { action: "back" } });
check("AM sends v2 back to the creative", back.status === 200 && back.json?.decision === "back", `${back.status} ${back.text.slice(0, 120)}`);
check("decision can't be made twice", (await am.req(`/api/drift/${alert2}`, { method: "POST", body: { action: "send" } })).status === 409);
check("still held after 'back'", (await admin.from("deliverables").select("status").eq("id", dId).single()).data?.status === "draft");

// v3 fixes it → all done → send to client → approve
const up3 = await am.req(`/api/deliverables/${dId}/versions`, { method: "POST", body: { copy: "Light up your Diwali. Shop the sale. Free delivery.", assetPath: await uploadPng() } });
check("v3 upload is held too (re-checked)", up3.status === 201 && up3.json?.held === true, `${up3.status} ${up3.text.slice(0, 120)}`);
const a3 = await waitForCard(up3.json?.alertId);
const res3 = a3?.detail?.results ?? [];
check("v3: both changes done", verdictOf(res3, cta?.id) === "done" && verdictOf(res3, free?.id) === "done", JSON.stringify(res3));
const send = await am.req(`/api/drift/${up3.json?.alertId}`, { method: "POST", body: { action: "send" } });
check("AM sends v3 to the client", send.status === 200 && send.json?.decision === "sent", `${send.status} ${send.text.slice(0, 120)}`);
const { data: d3 } = await admin.from("deliverables").select("status, current_version").eq("id", dId).single();
const { data: v3row } = await admin.from("versions").select("card_message_id").eq("id", up3.json?.versionId).single();
check("v3 card posted, deliverable in review", d3?.status === "in_review" && d3?.current_version === 3 && Boolean(v3row?.card_message_id), JSON.stringify(d3));
check("client can open v3 now", (await approver.req(`/api/assets/${up3.json?.versionId}`)).status === 302);
check("client still can't open skipped v2", (await approver.req(`/api/assets/${v2}`)).status === 404);
const appr3 = await approver.req(`/api/versions/${up3.json?.versionId}/approve`, { method: "POST" });
check("approver approves v3", appr3.status === 200, `${appr3.status} ${appr3.text.slice(0, 120)}`);

// FR-13: ledger + CSV
await sleep(500);
const csv = await am.req(`/api/projects/${projectId}/ledger.csv`);
check("AM exports the ledger CSV", csv.status === 200 && csv.text.replace(/^﻿/, "").startsWith('"Deliverable"'), `${csv.status} ${csv.text.slice(0, 80)}`);
check("CSV has the approval (v3, approved copy, approver)", csv.text.includes('"v3"') && csv.text.includes("Shop the sale") && csv.text.includes('"Priya"'));
const csvF = await am.req(`/api/projects/${projectId}/ledger.csv?q=nothing-matches-this`);
check("CSV filters apply", csvF.status === 200 && csvF.text.trim().split("\r\n").length === 1);
const csvA = await am.req(`/api/projects/${projectId}/ledger.csv?approver=${priya.user_id}`);
check("CSV filter by approver", csvA.text.split("\r\n").filter(Boolean).length === 2);
check("client can't export the ledger", (await approver.req(`/api/projects/${projectId}/ledger.csv`)).status === 404);
check("anonymous can't export the ledger", (await stranger.req(`/api/projects/${projectId}/ledger.csv`)).status === 401);
const page = await am.req(`/app/projects/${projectId}/ledger`);
check("ledger page renders", page.status === 200 && page.text.includes("Approval ledger") && page.text.includes("Shop the sale"), `${page.status}`);

// FR-14: dashboard
const proj2 = await am.req(`/app/projects/${projectId}`);
check("dashboard on the project page", proj2.status === 200 && proj2.text.includes("Rounds used") && proj2.text.includes("Open changes"), `${proj2.status}`);
check("client can't change rounds", (await approver.req(`/api/projects/${projectId}`, { method: "PATCH", body: { roundsIncluded: 5 } })).status !== 200);
const rounds = await am.req(`/api/projects/${projectId}`, { method: "PATCH", body: { roundsIncluded: 3 } });
check("AM sets rounds included", rounds.status === 200, `${rounds.status} ${rounds.text.slice(0, 80)}`);

// Monthly client report
const istNow = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 7);
const rep = await am.req(`/app/projects/${projectId}/report?month=${istNow}`);
const repText = rep.text.replace(/<!-- -->/g, "");
check("monthly report renders with this month's approval", rep.status === 200 && repText.includes("Monthly client report") && repText.includes("Deliverables approved"), `${rep.status} ${repText.includes("Nothing happened") ? "empty" : repText.includes("Building the report") ? "fallback-only" : "other"}`);
const empty = await am.req(`/app/projects/${projectId}/report?month=2020-01`);
check("empty month says nothing happened", empty.text.replace(/<!-- -->/g, "").includes("Nothing happened in this project"));
const share = await am.req(`/api/projects/${projectId}/report/share`, { method: "POST", body: { month: istNow } });
check("AM shares the report in the client room", share.status === 200, `${share.status} ${share.text.slice(0, 120)}`);
check("client can't share the report", [403, 404].includes((await approver.req(`/api/projects/${projectId}/report/share`, { method: "POST", body: { month: istNow } })).status));
check("anonymous can't share the report", (await stranger.req(`/api/projects/${projectId}/report/share`, { method: "POST", body: { month: istNow } })).status === 401);
check("empty month can't be shared", (await am.req(`/api/projects/${projectId}/report/share`, { method: "POST", body: { month: "2020-01" } })).status === 409);


// Push notifications: subscribe/unsubscribe per device, server-checked
const fakeSub = (tag) => ({ endpoint: `https://push.example.invalid/drifty-e2e-${tag}-${Date.now()}`, keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } });
const amSub = fakeSub("am");
const subRes = await am.req("/api/push/subscribe", { method: "POST", body: amSub });
check("AM turns on alerts", subRes.status === 201, `${subRes.status} ${subRes.text.slice(0, 80)}`);
const clientSub = fakeSub("client");
check("client turns on alerts", (await approver.req("/api/push/subscribe", { method: "POST", body: clientSub })).status === 201);
check("anonymous can't turn on alerts", (await stranger.req("/api/push/subscribe", { method: "POST", body: fakeSub("x") })).status === 401);
check("non-https endpoint is refused", (await am.req("/api/push/subscribe", { method: "POST", body: { ...fakeSub("y"), endpoint: "http://push.example.invalid/x" } })).status === 400);
const { data: subRows } = await admin.from("push_subscriptions").select("endpoint").in("endpoint", [amSub.endpoint, clientSub.endpoint]);
check("both devices stored", subRows?.length === 2, `${subRows?.length}`);
const off = await am.req("/api/push/subscribe", { method: "DELETE", body: { endpoint: amSub.endpoint } });
const { data: left } = await admin.from("push_subscriptions").select("endpoint").eq("endpoint", amSub.endpoint);
check("AM turns alerts off", off.status === 200 && left?.length === 0, `${off.status}`);
await admin.from("push_subscriptions").delete().like("endpoint", "https://push.example.invalid/%");
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
