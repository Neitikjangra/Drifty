// End-to-end check of Round 5 (launch pages, headers, rate limits, plan limit, demo seed) against a LOCAL server.
// Usage: node scripts/e2e-round5.mjs [http://localhost:3101]
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
const admin = createClient(URL_, strip(process.env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false } });

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

const stamp = Date.now().toString(36);
const am = new Browser(), stranger = new Browser();
console.log(`E2E Round 5 against ${BASE}\n`);

// Launch pages + security headers
for (const path of ["/", "/privacy", "/terms"]) {
  const res = await fetch(BASE + path);
  const html = await res.text();
  check(`${path} renders`, res.status === 200 && html.includes("Drifty"), `${res.status}`);
  if (path === "/") {
    check("landing has pricing, FAQ and Start free", html.includes('id="pricing"') && html.includes('id="faq"') && html.includes("Start free"));
    check("security headers set", res.headers.get("x-frame-options") === "DENY" && res.headers.get("x-content-type-options") === "nosniff" && /frame-ancestors 'none'/.test(res.headers.get("content-security-policy") ?? ""));
    check("microphone allowed for voice notes only on our site", /microphone=\(self\)/.test(res.headers.get("permissions-policy") ?? ""));
  }
}
const joinHead = await fetch(`${BASE}/join/not-a-real-token`);
check("invite pages never leak the token as referrer", joinHead.headers.get("referrer-policy") === "no-referrer");
check("unknown page → friendly 404", (await fetch(`${BASE}/definitely-not-here`)).status === 404);

// Rate limits (IP rules apply when x-forwarded-for is present, as on Vercel)
const fakeIp = `203.0.113.${(Date.now() % 200) + 1}`;
let limitedAt = 0;
for (let i = 1; i <= 22; i++) {
  const r = await fetch(`${BASE}/api/join/x${stamp}${i}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": fakeIp }, body: "{}" });
  if (r.status === 429) {
    limitedAt = i;
    check("429 carries Retry-After", Boolean(r.headers.get("retry-after")));
    break;
  }
}
check("join is rate limited per IP (20 / 10 min)", limitedAt === 21, `limited at ${limitedAt}`);
const other = await fetch(`${BASE}/api/join/y${stamp}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" }, body: "{}" });
check("other IPs aren't affected", other.status !== 429, `${other.status}`);

// Crash reports endpoint (no-op without SENTRY_DSN, always 204)
const ce = await fetch(`${BASE}/api/client-error`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "TypeError", digest: null, path: "/app", frames: "at x (app.js:1:1)" }) });
check("client error reports accepted", ce.status === 204, `${ce.status}`);

// Free plan: 2 active clients; demo doesn't count; archive frees a slot
const email = `e2e-r5-${stamp}@drifty.test`;
await admin.auth.admin.createUser({ email, email_confirm: true });
await signIn(am, email);
const onb = await am.req("/api/onboarding", { method: "POST", body: { workspaceName: `E2E Round 5 ${stamp} (test)`, displayName: "R5 AM", withDemo: true } });
check("onboarding with demo returns the demo project", onb.status === 201 && Boolean(onb.json?.demoProjectId), `${onb.status} ${onb.text.slice(0, 160)}`);
const demoId = onb.json?.demoProjectId;
const { data: demo } = await admin.from("projects").select("is_demo, approver_id, client_channel_id").eq("id", demoId).single();
check("demo project is flagged and has an approver", demo?.is_demo === true && Boolean(demo?.approver_id));
const { data: demoD } = await admin.from("deliverables").select("id, current_version").eq("project_id", demoId);
check("demo has a v1 deliverable", demoD?.length === 1 && demoD[0].current_version === 1);
const { data: demoV } = await admin.from("versions").select("id, created_at, card_message_id").eq("deliverable_id", demoD?.[0]?.id).single();
const { data: demoM } = await admin.from("messages").select("sent_at").eq("project_id", demoId);
check("demo feedback (3 messages) all after v1", demoM?.length === 3 && demoM.every((m) => m.sent_at > demoV.created_at), JSON.stringify(demoM));
check("demo v1 card posted", Boolean(demoV?.card_message_id));
const again = await am.req("/api/demo", { method: "POST" });
check("only one demo per workspace", again.status === 200 && again.json?.projectId === demoId && again.json?.existing === true);
const p1 = await am.req("/api/projects", { method: "POST", body: { clientName: `R5 A ${stamp}` } });
const p2 = await am.req("/api/projects", { method: "POST", body: { clientName: `R5 B ${stamp}` } });
check("free plan: 2 clients (plus the demo) allowed", p1.status === 201 && p2.status === 201, `${p1.status} ${p2.status}`);
const p3 = await am.req("/api/projects", { method: "POST", body: { clientName: `R5 C ${stamp}` } });
check("free plan: 3rd active client refused with a clear message", p3.status === 403 && p3.json?.code === "plan_limit" && /2 active clients/.test(p3.json?.error ?? ""), `${p3.status} ${p3.text.slice(0, 120)}`);
const arch = await am.req(`/api/projects/${p1.json.id}`, { method: "PATCH", body: { archived: true } });
check("archive a project", arch.status === 200, `${arch.status}`);
const p4 = await am.req("/api/projects", { method: "POST", body: { clientName: `R5 D ${stamp}` } });
check("archiving frees a slot", p4.status === 201, `${p4.status}`);
const restore = await am.req(`/api/projects/${p1.json.id}`, { method: "PATCH", body: { archived: false } });
check("restore refused while at the limit", restore.status === 403 && restore.json?.code === "plan_limit", `${restore.status}`);
const list = await am.req("/app");
const listText = list.text.replace(/<!-- -->/g, "");
check("projects page shows plan usage and archived list", listText.includes("Free plan: 2 of 2 active clients") && listText.includes("Archived"), `${list.status}`);
const archivedPage = await am.req(`/app/projects/${p1.json.id}`);
check("team can still open an archived project", archivedPage.status === 200 && archivedPage.text.includes("(archived)"), `${archivedPage.status}`);
const demoPage = await am.req(`/app/projects/${demoId}`);
check("demo guide on the demo project", demoPage.text.includes("Demo guide"));
check("anonymous can't add a demo", (await stranger.req("/api/demo", { method: "POST" })).status === 401);

// The approver's conflict choice can't be overridden by the team (FR-12)
const { data: wsRow } = await admin.from("projects").select("workspace_id").eq("id", demoId).single();
const { data: v1 } = await admin.from("versions").select("id").eq("deliverable_id", demoD[0].id).single();
const { data: alertRow } = await admin.from("drift_alerts").insert({ deliverable_id: demoD[0].id, version_id: v1.id, kind: "feedback", detail: {}, resolved_at: new Date().toISOString() }).select("id").single();
const { data: lost } = await admin
  .from("change_items")
  .insert({ version_id: v1.id, text: "Make the logo smaller", type: "visual", author_ids: ["x"], source_msg_ids: ["y"], status: "rejected", origin: "ai", conflict_id: alertRow.id })
  .select("id")
  .single();
const over = await am.req(`/api/changes/${lost.id}`, { method: "PATCH", body: { action: "confirm" } });
check("team can't confirm the option the approver turned down", over.status === 409, `${over.status} ${over.text.slice(0, 100)}`);
void wsRow;

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
