// End-to-end check of Round 6 (approval drift, scope drift, nudges, daily digest) against a LOCAL server.
// Usage: node scripts/e2e-round6.mjs [http://localhost:3101]
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
const CRON = strip(process.env.CRON_SECRET);
console.log(`E2E Round 6 against ${BASE}\n`);

let projectId = null;
async function uploadPng() {
  const slot = await am.req("/api/uploads", { method: "POST", body: { projectId, contentType: "image/png", size: PNG.length } });
  await anon.storage.from("deliverables").uploadToSignedUrl(slot.json.path, slot.json.token, PNG, { contentType: "image/png" });
  return slot.json.path;
}
async function waitFor(fn, seconds = 30) {
  for (let i = 0; i < seconds * 2; i++) {
    const v = await fn();
    if (v) return v;
    await sleep(500);
  }
  return null;
}
const alertsOf = async (dId, kind) => (await admin.from("drift_alerts").select("id, resolved_at, card_message_id, detail").eq("deliverable_id", dId).eq("kind", kind).order("created_at")).data ?? [];
const tomorrowIst = new Date(Date.now() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);

// Setup
await signIn(am, "e2e-r6@drifty.test");
await am.req("/api/onboarding", { method: "POST", body: { workspaceName: "E2E Round 6 Agency (test)", displayName: "R6 AM" } });
await admin.from("workspaces").update({ plan: "pilot" }).eq("name", "E2E Round 6 Agency (test)");
const proj = await am.req("/api/projects", { method: "POST", body: { clientName: `R6 Diwali ${stamp}` } });
projectId = proj.json?.id;
check("setup: project", proj.status === 201, proj.text.slice(0, 120));
const { data: p } = await admin.from("projects").select("client_channel_id, internal_channel_id").eq("id", projectId).single();
const invA = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "priya@r6.test", name: "Priya", role: "approver" } });
const invR = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "rahul@r6.test", name: "Rahul", role: "reviewer" } });
await approver.req(`/api/join/${invA.json.link.split("/join/")[1]}`, { method: "POST", body: { name: "Priya" } });
await reviewer.req(`/api/join/${invR.json.link.split("/join/")[1]}`, { method: "POST", body: { name: "Rahul" } });
const { data: guests } = await admin.from("project_guests").select("role, profiles(nexconn_user_id)").eq("project_id", projectId);
const priyaId = guests.find((g) => g.role === "approver").profiles.nexconn_user_id;
const rahulId = guests.find((g) => g.role === "reviewer").profiles.nexconn_user_id;
const d1 = (await am.req("/api/deliverables", { method: "POST", body: { projectId, title: "Diwali post", copy: "Buy now.", assetPath: await uploadPng() } })).json?.id;
const d2 = (await am.req("/api/deliverables", { method: "POST", body: { projectId, title: "Banner", copy: "Sale.", dueDate: tomorrowIst, assetPath: await uploadPng() } })).json?.id;
check("setup: two deliverables", Boolean(d1 && d2));
// Only one card in review for the approval check: park the banner.
await admin.from("deliverables").update({ status: "changes_requested" }).eq("id", d2);

// FR-16 approval drift
await webhook(msgEvent(rahulId, p.client_channel_id, "ok", `R6-${stamp}-r`));
await webhook(msgEvent(priyaId, p.client_channel_id, "ok but make the logo bigger", `R6-${stamp}-c`));
await sleep(3000);
check("reviewer's 'ok' and an 'ok but…' don't trigger a check", (await alertsOf(d1, "approval")).length === 0);
await webhook(msgEvent(priyaId, p.client_channel_id, "👍", `R6-${stamp}-1`));
const a1 = await waitFor(async () => (await alertsOf(d1, "approval")).find((a) => a.card_message_id));
check("approver's 👍 → 'Does this approve all of v1?' card in the client room", Boolean(a1));
await webhook(msgEvent(priyaId, p.client_channel_id, "ok", `R6-${stamp}-2`));
await sleep(3000);
check("one open question per version", (await alertsOf(d1, "approval")).length === 1);
check("reviewer can't answer", (await reviewer.req(`/api/approval-checks/${a1?.id}`, { method: "POST", body: { answer: "yes" } })).status === 403);
check("AM can't answer for the client", (await am.req(`/api/approval-checks/${a1?.id}`, { method: "POST", body: { answer: "yes" } })).status === 403);
check("anonymous can't answer", (await stranger.req(`/api/approval-checks/${a1?.id}`, { method: "POST", body: { answer: "yes" } })).status === 401);
const no = await approver.req(`/api/approval-checks/${a1?.id}`, { method: "POST", body: { answer: "no" } });
check("approver answers No: nothing approved", no.status === 200 && (await admin.from("deliverables").select("status").eq("id", d1).single()).data?.status === "in_review", `${no.status}`);
check("can't answer twice", (await approver.req(`/api/approval-checks/${a1?.id}`, { method: "POST", body: { answer: "yes" } })).status === 409);
await webhook(msgEvent(priyaId, p.client_channel_id, "theek hai", `R6-${stamp}-3`));
const a2 = await waitFor(async () => (await alertsOf(d1, "approval")).find((a) => a.card_message_id && !a.resolved_at));
check("a new vague approval asks again", Boolean(a2));
const yes = await approver.req(`/api/approval-checks/${a2?.id}`, { method: "POST", body: { answer: "yes" } });
const { data: d1row } = await admin.from("deliverables").select("status").eq("id", d1).single();
const { data: v1 } = await admin.from("versions").select("id").eq("deliverable_id", d1).eq("number", 1).single();
const { data: ledger } = await admin.from("approvals").select("id, copy_snapshot").eq("version_id", v1.id);
check("Yes = a real approval (ledger row with the exact copy)", yes.status === 200 && d1row?.status === "approved" && ledger?.length === 1 && ledger[0].copy_snapshot === "Buy now.", `${yes.status} ${d1row?.status}`);

// FR-15 scope drift (1 round included): v2 = at the limit, v3 = over
await am.req(`/api/projects/${projectId}`, { method: "PATCH", body: { roundsIncluded: 1 } });
await admin.from("deliverables").update({ status: "in_review" }).eq("id", d2);
await am.req(`/api/deliverables/${d2}/versions`, { method: "POST", body: { copy: "Sale v2.", assetPath: await uploadPng() } });
const s1 = await waitFor(async () => (await alertsOf(d2, "scope")).find((a) => a.card_message_id), 45);
check("round 1 of 1 → scope warning in the internal room", s1?.detail?.state === "at_limit", JSON.stringify(s1?.detail));
await am.req(`/api/deliverables/${d2}/versions`, { method: "POST", body: { copy: "Sale v3.", assetPath: await uploadPng() } });
const s2 = await waitFor(async () => (await alertsOf(d2, "scope")).find((a) => a.card_message_id && a.detail?.roundsUsed === 2), 45);
check("round 2 of 1 → 'over' warning", s2?.detail?.state === "over", JSON.stringify(s2?.detail));
check("client can't send the note", [403, 404].includes((await approver.req(`/api/scope/${s1?.id}`, { method: "POST", body: { action: "send", text: "Hello there, client." } })).status));
const sent = await am.req(`/api/scope/${s1?.id}`, { method: "POST", body: { action: "send", text: "Quick note: this version uses the last included round." } });
check("AM sends the (edited) note as themselves", sent.status === 200, `${sent.status} ${sent.text.slice(0, 120)}`);
check("can't send twice", (await am.req(`/api/scope/${s1?.id}`, { method: "POST", body: { action: "send", text: "Again, a second time." } })).status === 409);
check("AM can discard the other", (await am.req(`/api/scope/${s2?.id}`, { method: "POST", body: { action: "discard" } })).status === 200);

// FR-17 nudges + FR-18 digest (cron limited to this project)
check("cron refuses without the secret", (await fetch(`${BASE}/api/cron/daily?project=${projectId}`)).status === 401);
check("cron refuses a wrong secret", (await fetch(`${BASE}/api/cron/daily?project=${projectId}`, { headers: { authorization: "Bearer nope" } })).status === 401);
const run1 = await fetch(`${BASE}/api/cron/daily?project=${projectId}`, { headers: { authorization: `Bearer ${CRON}` } });
const r1 = await run1.json();
check("daily run: nudge for the card due tomorrow + digest", run1.status === 200 && r1.nudges === 1 && r1.digests === 1, JSON.stringify(r1));
const run2 = await (await fetch(`${BASE}/api/cron/daily?project=${projectId}`, { headers: { authorization: `Bearer ${CRON}` } })).json();
check("re-run the same day sends nothing twice", run2.nudges === 0 && run2.digests === 0, JSON.stringify(run2));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
