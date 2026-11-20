// End-to-end check of Round 1 against a LOCAL server (pnpm build && pnpm start).
// Uses test identities only (*.test emails, generated guests). Prints pass/fail per check.
// Usage: node scripts/e2e-round1.mjs [http://localhost:3100]
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
const BASE = (process.argv[2] ?? "http://localhost:3100").replace(/\/+$/, "");
if (!/^http:\/\/localhost(:\d+)?$/.test(BASE)) {
  console.error("This test only runs against localhost.");
  process.exit(1);
}
const strip = (v) => v?.trim().replace(/^"(.*)"$/, "$1");
const admin = createClient(strip(process.env.NEXT_PUBLIC_SUPABASE_URL), strip(process.env.SUPABASE_SERVICE_ROLE_KEY), {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------- tiny cookie-jar client
class Browser {
  constructor(name) {
    this.name = name;
    this.jar = new Map();
  }
  cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (!v || /max-age=0/i.test(c) || /expires=Thu, 01 Jan 1970/i.test(c)) this.jar.delete(k);
      else this.jar.set(k, v);
    }
  }
  async req(path, { method = "GET", body, follow = false } = {}) {
    let url = path.startsWith("http") ? path : BASE + path;
    for (let hops = 0; hops < 6; hops++) {
      const res = await fetch(url, {
        method,
        redirect: "manual",
        headers: { cookie: this.cookieHeader(), ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      this.store(res);
      const loc = res.headers.get("location");
      if (follow && loc && res.status >= 300 && res.status < 400) {
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
      return { status: res.status, location: loc, json, text, url };
    }
    throw new Error("too many redirects");
  }
}

// ---------------------------------------------------------------- reporting
let failed = 0;
let passed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  →  ${detail}` : ""}`);
}

async function signIn(browser, email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  // Second link if the first one was a sign-up (new user).
  let hash = data.properties.hashed_token;
  if (data.properties.verification_type !== "magiclink") {
    const again = await admin.auth.admin.generateLink({ type: "magiclink", email });
    hash = again.data.properties.hashed_token;
  }
  return browser.req(`/auth/callback?token_hash=${hash}&type=magiclink&next=/app`, { follow: true });
}

// ---------------------------------------------------------------- run
const stamp = Date.now().toString(36);
const am = new Browser("AM");
const client = new Browser("client");
const client2 = new Browser("client2");
const stranger = new Browser("stranger");
const otherAgency = new Browser("other agency");

console.log(`E2E Round 1 against ${BASE}\n`);

// Health + public pages
const health = await stranger.req("/api/health");
check("health endpoint ok, all keys present", health.json?.ok && Object.values(health.json.configured).every(Boolean), JSON.stringify(health.json?.configured));
check("home page renders", (await stranger.req("/")).status === 200);
check("login page renders", (await stranger.req("/login")).status === 200);
const gate = await stranger.req("/app");
check("signed-out /app redirects to /login", gate.status >= 300 && gate.status < 400 && gate.location?.includes("/login"), `${gate.status} ${gate.location}`);
const stray = await stranger.req("/?code=abc");
check("stray /?code= link is forwarded to /auth/callback", stray.location?.includes("/auth/callback?code=abc"), stray.location ?? String(stray.status));
const badCb = await stranger.req("/auth/callback?code=bogus", { follow: true });
check("bad sign-in link ends on login with a friendly error", badCb.url.includes("/login?error=link"), badCb.url);

// Anonymous API access is refused
for (const [path, method, body] of [
  ["/api/projects", "POST", { clientName: "x" }],
  ["/api/onboarding", "POST", { workspaceName: "x", displayName: "x" }],
  ["/api/invites", "POST", { projectId: "00000000-0000-4000-8000-000000000000", emailOrPhone: "a@b.test", name: "x", role: "approver" }],
  ["/api/nexconn/token", "POST", undefined],
  ["/api/projects/00000000-0000-4000-8000-000000000000", "PATCH", { roundsIncluded: 3 }],
  ["/api/invites/00000000-0000-4000-8000-000000000000/revoke", "POST", undefined],
  ["/api/chat/directory", "POST", { userIds: ["driftybot"] }],
]) {
  const r = await stranger.req(path, { method, body });
  check(`anonymous ${method} ${path} refused with 401`, r.status === 401, `${r.status}`);
}

// AM: sign in + onboarding (new test user each run)
const amEmail = `am-${stamp}@drifty.test`;
const landed = await signIn(am, amEmail);
// Redirects inside streamed pages happen in the browser, so look for the redirect instruction too.
check(
  "AM magic link signs in and is sent to onboarding",
  landed.url.includes("/app/onboarding") || (landed.url.endsWith("/app") && landed.text.includes("/app/onboarding")),
  landed.url,
);
const badOnb = await am.req("/api/onboarding", { method: "POST", body: { workspaceName: "", displayName: "" } });
check("onboarding rejects empty fields", badOnb.status === 400, `${badOnb.status}`);
const onb = await am.req("/api/onboarding", { method: "POST", body: { workspaceName: `E2E Agency ${stamp}`, displayName: "E2E AM" } });
check("onboarding creates workspace", onb.status === 201, `${onb.status} ${onb.text.slice(0, 120)}`);
const onb2 = await am.req("/api/onboarding", { method: "POST", body: { workspaceName: "again", displayName: "again" } });
check("onboarding is idempotent", onb2.status === 200 && onb2.json?.alreadyDone, `${onb2.status}`);
const projectsPage = await am.req("/app");
check("projects page renders for AM (empty state)", projectsPage.status === 200 && projectsPage.text.includes("No projects yet"), `${projectsPage.status}`);

// FR-2: project + two rooms
const badProj = await am.req("/api/projects", { method: "POST", body: { clientName: "" } });
check("create project rejects empty name", badProj.status === 400);
const proj = await am.req("/api/projects", { method: "POST", body: { clientName: `Diwali campaign ${stamp}` } });
check("create project → 201", proj.status === 201, `${proj.status} ${proj.text.slice(0, 160)}`);
const projectId = proj.json?.id;
const { data: projRow } = await admin.from("projects").select("client_channel_id, internal_channel_id, workspace_id").eq("id", projectId).single();
check("project has client + internal Nexconn channel ids", Boolean(projRow?.client_channel_id && projRow?.internal_channel_id));
const projPage = await am.req(`/app/projects/${projectId}`);
check("AM can open the project page", projPage.status === 200 && projPage.text.includes("Client room") && projPage.text.includes("Internal"), `${projPage.status}`);
const amTok = await am.req("/api/nexconn/token", { method: "POST" });
check("AM gets a Nexconn token", amTok.status === 200 && typeof amTok.json?.token === "string");
const amDir = await am.req("/api/chat/directory", {
  method: "POST",
  body: { groupIds: [projRow.client_channel_id, projRow.internal_channel_id, ""], userIds: ["driftybot", ""], membersOf: projRow.internal_channel_id },
});
check("AM directory: sees both rooms", amDir.json?.groups?.length === 2, JSON.stringify(amDir.json?.groups));
check("directory ignores empty ids and names the bot", amDir.status === 200 && amDir.json?.users?.some((u) => u.name === "Drifty AI"));
check("internal room members include bot + AM", (amDir.json?.members?.length ?? 0) >= 2, JSON.stringify(amDir.json?.members));

// FR-3: invites
const inv = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "client@e2e.test", name: "E2E Client", role: "approver" } });
check("AM creates approver invite", inv.status === 201 && inv.json?.link?.includes("/join/"), `${inv.status} ${inv.text.slice(0, 120)}`);
const token = inv.json?.link?.split("/join/")[1];
const { data: invRow } = await admin.from("invites").select("token_hash, expires_at").eq("id", inv.json?.id).single();
check("invite token is not stored in plain text", invRow && !invRow.token_hash.includes(token));
const days = (new Date(invRow?.expires_at).getTime() - Date.now()) / 86400000;
check("invite link lasts ~30 days", days > 29.9 && days <= 30.01, `${days.toFixed(2)} days`);
const copied = await am.req(`/api/invites/${inv.json?.id}/link`);
check("'Copy link again' returns the same link", copied.status === 200 && copied.json?.link === inv.json?.link, `${copied.status}`);
const joinPage = await client.req(`/join/${token}`);
check("join page shows the invite", joinPage.status === 200 && joinPage.text.includes("Join the room"), `${joinPage.status}`);
const amJoin = await am.req(`/api/join/${token}`, { method: "POST", body: { name: "AM" } });
check("agency user can't consume a client invite", amJoin.status === 409, `${amJoin.status}`);
const join = await client.req(`/api/join/${token}`, { method: "POST", body: { name: "E2E Client" } });
check("client joins with the link", join.status === 200 && join.json?.projectId === projectId, `${join.status} ${join.text.slice(0, 160)}`);
check("client got an httpOnly guest cookie", client.jar.has("drifty_guest"));
// Same personal link on a second device (fresh browser, no cookie) → same person, straight in.
const phone2 = new Browser("client second device");
const reusePage = await phone2.req(`/join/${token}`);
check("reopened link greets the person ('Welcome back')", reusePage.text.includes("Welcome back") && reusePage.text.includes("E2E Client"));
const reuse = await phone2.req(`/api/join/${token}`, { method: "POST", body: {} });
check("same link works again on another device (no name needed)", reuse.status === 200, `${reuse.status} ${reuse.text.slice(0, 120)}`);
const { data: afterReuse } = await admin.from("project_guests").select("user_id").eq("project_id", projectId);
check("reopening doesn't create a second person", afterReuse?.length === 1);
check("second device is signed in as the same person", (await phone2.req(`/room/${projectId}`)).text.includes("approver"));
const { data: usedRow } = await admin.from("invites").select("first_used_at, last_used_at").eq("id", inv.json?.id).single();
check("first_used_at and last_used_at recorded", Boolean(usedRow?.first_used_at && usedRow?.last_used_at && usedRow.last_used_at >= usedRow.first_used_at));
const cookieOnly = await client.req(`/room/${projectId}`);
check("returning without the link (cookie) goes straight to the room", cookieOnly.status === 200 && cookieOnly.text.includes("approver"));
const badTok = await client2.req(`/api/join/${"x".repeat(43)}`, { method: "POST", body: { name: "x" } });
check("unknown invite token refused", badTok.status === 410, `${badTok.status}`);

// Client access
const room = await client.req(`/room/${projectId}`);
check("client opens their room", room.status === 200 && room.text.includes("approver"), `${room.status}`);
const cTok = await client.req("/api/nexconn/token", { method: "POST" });
check("client gets a Nexconn token", cTok.status === 200 && typeof cTok.json?.token === "string");
const cDir = await client.req("/api/chat/directory", {
  method: "POST",
  body: { groupIds: [projRow.client_channel_id, projRow.internal_channel_id], membersOf: projRow.internal_channel_id },
});
check("client directory never shows the internal room", !JSON.stringify(cDir.json).includes(projRow.internal_channel_id) && !cDir.json?.members, JSON.stringify(cDir.json));
const cAgency = await client.req(`/app/projects/${projectId}`);
check("client can't open the agency project page", cAgency.status >= 300 && cAgency.status < 400 && cAgency.location?.includes("/login"), `${cAgency.status} ${cAgency.location}`);
for (const [label, path, method, body] of [
  ["create invite", "/api/invites", "POST", { projectId, emailOrPhone: "x@e2e.test", name: "x", role: "approver" }],
  ["change approver/rounds", `/api/projects/${projectId}`, "PATCH", { roundsIncluded: 5 }],
  ["create project", "/api/projects", "POST", { clientName: "x" }],
]) {
  const r = await client.req(path, { method, body });
  check(`client can't ${label}`, r.status === 401 || r.status === 403 || r.status === 404, `${r.status}`);
}
const { data: guestRows } = await admin.from("project_guests").select("role").eq("project_id", projectId);
check("client recorded as approver", guestRows?.length === 1 && guestRows[0].role === "approver");

// Second client as reviewer, then switch approver
const inv2 = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "+919999999999", name: "E2E Reviewer", role: "reviewer" } });
const join2 = await client2.req(`/api/join/${inv2.json?.link?.split("/join/")[1]}`, { method: "POST", body: { name: "E2E Reviewer" } });
check("reviewer joins (phone invite)", join2.status === 200, `${join2.status}`);
const room2 = await client2.req(`/room/${projectId}`);
check("reviewer room doesn't say approver", room2.status === 200 && !room2.text.includes("You&#x27;re the approver") && !room2.text.includes("You're the approver"));
const { data: reviewer } = await admin.from("project_guests").select("user_id").eq("project_id", projectId).eq("role", "reviewer").single();
const sw = await am.req(`/api/projects/${projectId}`, { method: "PATCH", body: { approverId: reviewer.user_id } });
check("AM switches the approver", sw.status === 200, `${sw.status}`);
const { data: roles } = await admin.from("project_guests").select("user_id, role").eq("project_id", projectId);
check("exactly one approver after switch", roles?.filter((r) => r.role === "approver").length === 1 && roles.find((r) => r.user_id === reviewer.user_id)?.role === "approver");
const badApprover = await am.req(`/api/projects/${projectId}`, { method: "PATCH", body: { approverId: "00000000-0000-4000-8000-000000000000" } });
check("approver must be a client of the project", badApprover.status === 400, `${badApprover.status}`);

// Revoke an unused invite
const inv3 = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "late@e2e.test", name: "Late", role: "reviewer" } });
const rev = await am.req(`/api/invites/${inv3.json?.id}/revoke`, { method: "POST" });
check("AM cancels an unused invite", rev.status === 200, `${rev.status}`);
const revToken = inv3.json?.link?.split("/join/")[1];
const revJoin = await stranger.req(`/api/join/${revToken}`, { method: "POST", body: { name: "Late" } });
check("cancelled link no longer works", revJoin.status === 410 && /cancelled/.test(revJoin.json?.error ?? ""), `${revJoin.status} ${revJoin.json?.error}`);
const revPage = await stranger.req(`/join/${revToken}`);
check("cancelled link page says 'Ask your agency for a new link'", revPage.text.includes("Ask your agency for a new link"));

// Revoke a joined person's link → they lose the room; a new link brings them back
const remove = await am.req(`/api/invites/${inv.json?.id}/revoke`, { method: "POST" });
check("revoking a joined client's link removes them", remove.status === 200 && remove.json?.removedFromRoom === true, `${remove.status} ${remove.text.slice(0, 100)}`);
const lockedOut = await client.req(`/room/${projectId}`);
check("removed client can't open the room any more", lockedOut.text.includes("have access to this room"));
const lockedTok = await client.req("/api/chat/directory", { method: "POST", body: { groupIds: [projRow.client_channel_id] } });
check("removed client's directory no longer shows the room", (lockedTok.json?.groups?.length ?? 0) === 0, JSON.stringify(lockedTok.json));
const reissue = await am.req(`/api/invites/${inv.json?.id}/reissue`, { method: "POST" });
check("AM creates a new link for the same person", reissue.status === 201 && reissue.json?.link && reissue.json.link !== inv.json?.link, `${reissue.status}`);
const back = await client.req(`/api/join/${reissue.json?.link?.split("/join/")[1]}`, { method: "POST", body: {} });
check("new link brings the same person back without a name", back.status === 200, `${back.status} ${back.text.slice(0, 120)}`);
const { data: backRows } = await admin.from("project_guests").select("user_id").eq("project_id", projectId);
check("still one record per person after re-issue", backRows?.length === 2, `${backRows?.length}`);

// Tenant isolation: another agency can't see this project
await signIn(otherAgency, `other-${stamp}@drifty.test`);
await otherAgency.req("/api/onboarding", { method: "POST", body: { workspaceName: `Other ${stamp}`, displayName: "Other" } });
const otherPage = await otherAgency.req(`/app/projects/${projectId}`);
check("another agency gets 404 for this project", otherPage.status === 404 || otherPage.text.includes("could not be found"), `${otherPage.status}`);
const otherInvite = await otherAgency.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "x@e2e.test", name: "x", role: "approver" } });
check("another agency can't invite into this project", otherInvite.status === 404, `${otherInvite.status}`);
const otherDir = await otherAgency.req("/api/chat/directory", { method: "POST", body: { groupIds: [projRow.client_channel_id, projRow.internal_channel_id] } });
check("another agency's directory shows neither room", (otherDir.json?.groups?.length ?? 0) === 0, JSON.stringify(otherDir.json));

// Sign out
const out = await am.req("/auth/signout", { method: "POST" });
const afterOut = await am.req("/app");
check("sign out ends the session", out.status === 303 && afterOut.location?.includes("/login"), `${out.status} ${afterOut.location}`);

// ---------------------------------------------------------------- cleanup (only what this run created)
async function cleanup() {
  const emails = [amEmail, `other-${stamp}@drifty.test`];
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const users = (list?.users ?? []).filter((u) => emails.includes(u.email));
  const ownerIds = users.map((u) => u.id);
  const { data: wss } = ownerIds.length ? await admin.from("workspaces").select("id").in("owner_id", ownerIds) : { data: [] };
  const wsIds = (wss ?? []).map((w) => w.id);
  const { data: projs } = wsIds.length ? await admin.from("projects").select("id").in("workspace_id", wsIds) : { data: [] };
  const projIds = (projs ?? []).map((p) => p.id);
  const { data: guests } = projIds.length ? await admin.from("project_guests").select("user_id").in("project_id", projIds) : { data: [] };
  const profileIds = [...ownerIds, ...(guests ?? []).map((g) => g.user_id)];
  if (wsIds.length) await admin.from("workspaces").delete().in("id", wsIds); // cascades projects, members, guests, invites
  if (profileIds.length) await admin.from("profiles").delete().in("user_id", profileIds);
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
  console.log(`cleanup: removed ${wsIds.length} test workspace(s), ${projIds.length} project(s), ${profileIds.length} profile(s), ${users.length} test user(s)`);
}
await cleanup().catch((e) => console.log("cleanup failed:", e instanceof Error ? e.message : e));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
