// End-to-end check of Round 7 (new project form, project team, team invites, delete project)
// against a LOCAL server. Fixed test agency e2e-r7@drifty.test; a new creative test user each run.
// Usage: node scripts/e2e-round7.mjs [http://localhost:3101]
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

// ---------------------------------------------------------------- run
const stamp = Date.now().toString(36);
const owner = new Browser(), creative = new Browser(), other = new Browser(), client = new Browser(), stranger = new Browser();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
console.log(`E2E Round 7 against ${BASE}\n`);

await signIn(owner, "e2e-r7@drifty.test");
await owner.req("/api/onboarding", { method: "POST", body: { workspaceName: "E2E Round 7 Agency (test)", displayName: "R7 Owner" } });
await admin.from("workspaces").update({ plan: "pilot" }).eq("name", "E2E Round 7 Agency (test)");

// Projects page: a button, not an always-open form
const home = await owner.req("/app");
check("projects page shows a New project button", home.status === 200 && /New project|Create your first project/.test(home.text), `${home.status}`);
check("no always-open project name field", !home.text.includes('id="clientName"'));

// Team invite links
check("invite needs a known role", (await owner.req("/api/team/invites", { method: "POST", body: { title: "wizard" } })).status === 400);
const inv = await owner.req("/api/team/invites", { method: "POST", body: { title: "designer" } });
check("owner creates a creative team link", inv.status === 201 && /\/team\/join\/[A-Za-z0-9_-]{43}$/.test(inv.json?.link ?? ""), `${inv.status} ${inv.text.slice(0, 120)}`);
const tToken = (inv.json?.link ?? "").split("/team/join/")[1];
const tPage = await stranger.req(`/team/join/${tToken}`);
check("team link page asks a stranger to sign in", tPage.status === 200 && tPage.text.includes("Sign in or create an account"), `${tPage.status}`);
check("anonymous can't use a team link", (await stranger.req(`/api/team/join/${tToken}`, { method: "POST", body: { name: "x" } })).status === 401);
const creativeEmail = `e2e-r7-creative-${stamp}@drifty.test`;
await signIn(creative, creativeEmail);
const tj = await creative.req(`/api/team/join/${tToken}`, { method: "POST", body: { name: "R7 Creative" } });
check("new teammate joins with the link", tj.status === 201, `${tj.status} ${tj.text.slice(0, 120)}`);
await signIn(other, `e2e-r7-other-${stamp}@drifty.test`);
check("team link works only once", (await other.req(`/api/team/join/${tToken}`, { method: "POST", body: { name: "Other" } })).status === 410);
const { data: cProf } = await admin.from("profiles").select("user_id").eq("email", creativeEmail).single();
const creativeId = cProf?.user_id;
const { data: cMem } = await admin.from("members").select("role, title").eq("user_id", creativeId).single();
check("teammate joins as a Designer with creative access", cMem?.role === "creative" && cMem?.title === "designer", JSON.stringify(cMem));
check("creative can't invite teammates", (await creative.req("/api/team/invites", { method: "POST", body: { title: "copywriter" } })).status === 403);
check("creative can't change roles", (await creative.req(`/api/team/members/${creativeId}`, { method: "PATCH", body: { title: "account_manager" } })).status === 403);
const pmInv = await owner.req("/api/team/invites", { method: "POST", body: { title: "project_manager" } });
const { data: pmRow } = await admin.from("team_invites").select("role, title").eq("id", pmInv.json?.id).single();
check("project manager link gives manager access", pmInv.status === 201 && pmRow?.role === "am" && pmRow?.title === "project_manager", JSON.stringify(pmRow));
await owner.req(`/api/team/invites/${pmInv.json?.id}`, { method: "DELETE" });
const badToken = await other.req(`/api/team/join/${"x".repeat(43)}`, { method: "POST", body: { name: "Other" } });
check("made-up team link is refused", badToken.status === 404, `${badToken.status}`);
const teamPage = await owner.req("/app/team");
check("team page lists the creative with their role", teamPage.status === 200 && teamPage.text.includes("R7 Creative") && teamPage.text.includes("Designer"), `${teamPage.status}`);
const toCopy = await owner.req(`/api/team/members/${creativeId}`, { method: "PATCH", body: { title: "copywriter" } });
const { data: cw } = await admin.from("members").select("role, title").eq("user_id", creativeId).single();
check("owner changes the role to Copywriter", toCopy.status === 200 && cw?.role === "creative" && cw?.title === "copywriter", JSON.stringify(cw));

// New project with details
const name = `R7 Cafe ${stamp}`;
const np = await owner.req("/api/projects", {
  method: "POST",
  body: { clientName: name, scope: "8 posts a month", roundsIncluded: 3, brandRules: "Logo top-left", teamIds: [], contact: { name: "Meera", emailOrPhone: "meera@client.test" } },
});
const pid = np.json?.id;
check("owner creates a project with scope, rules and a client contact", np.status === 201 && /\/join\//.test(np.json?.inviteLink ?? ""), `${np.status} ${np.text.slice(0, 160)}`);
const { data: prow } = await admin.from("projects").select("scope_text, rounds_included, brand_rules").eq("id", pid).single();
check("project details are saved", prow?.scope_text === "8 posts a month" && prow?.rounds_included === 3 && prow?.brand_rules === "Logo top-left", JSON.stringify(prow));
const { data: firstInv } = await admin.from("invites").select("role").eq("project_id", pid);
check("client contact got an approver invite", firstInv?.length === 1 && firstInv[0].role === "approver", JSON.stringify(firstInv));

// Creatives only see their projects
// The page streams, so "not found" can arrive with a 200 status: check what it shows.
const notOn = await creative.req(`/app/projects/${pid}`);
check("creative can't open a project they're not on", notOn.status === 404 || !notOn.text.includes(name), `${notOn.status}`);
check("creative's list doesn't show it", !(await creative.req("/app")).text.includes(name));
const put = await owner.req(`/api/projects/${pid}`, { method: "PATCH", body: { teamIds: [creativeId] } });
check("owner puts the creative on the project", put.status === 200, `${put.status} ${put.text.slice(0, 120)}`);
const cPage = await creative.req(`/app/projects/${pid}`);
check("creative can open it now", cPage.status === 200 && cPage.text.includes(name), `${cPage.status}`);
check("creative still has no client room", !cPage.text.includes("Your client sees this room"));
check("creative can't delete the project", (await creative.req(`/api/projects/${pid}`, { method: "DELETE", body: { confirmName: name } })).status === 403);
const ownerPage = await owner.req(`/app/projects/${pid}`);
const op = ownerPage.text.replace(/<!-- -->/g, "");
check("project page keeps settings in the Settings panel", op.includes("Archive / delete") && op.includes("Client people") && op.includes("Brand &amp; scope"));

// Client joins, then can't delete
const cToken = np.json.inviteLink.split("/join/")[1];
const cj = await client.req(`/api/join/${cToken}`, { method: "POST", body: { name: "Meera" } });
check("client joins from the contact link", cj.status === 200, `${cj.status}`);
// The public pages' logo: home is the projects list, the client's room, or the landing page
check("logo takes the agency to their projects", (await owner.req("/api/me/home")).json?.home === "/app");
check("logo takes the client to their room", (await client.req("/api/me/home")).json?.home === `/room/${pid}`);
check("logo takes a visitor to the home page", (await stranger.req("/api/me/home")).json?.home === null);
check("client can't delete the project", [403, 404].includes((await client.req(`/api/projects/${pid}`, { method: "DELETE", body: { confirmName: name } })).status));
check("anonymous can't delete the project", (await stranger.req(`/api/projects/${pid}`, { method: "DELETE", body: { confirmName: name } })).status === 401);
check("wrong name doesn't delete", (await owner.req(`/api/projects/${pid}`, { method: "DELETE", body: { confirmName: "nope" } })).status === 400);
const del = await owner.req(`/api/projects/${pid}`, { method: "DELETE", body: { confirmName: name.toUpperCase() } });
check("owner deletes the project", del.status === 200, `${del.status} ${del.text.slice(0, 120)}`);
const { data: gone } = await admin.from("projects").select("id").eq("id", pid);
check("project and its rooms are gone", gone?.length === 0);

// A project with an approval can't be deleted (the ledger is permanent)
const keep = await owner.req("/api/projects", { method: "POST", body: { clientName: `R7 Ledger ${stamp}`, contact: { name: "Asha", emailOrPhone: "asha@client.test" } } });
const kid = keep.json?.id;
const asha = new Browser();
await asha.req(`/api/join/${keep.json.inviteLink.split("/join/")[1]}`, { method: "POST", body: { name: "Asha" } });
const slot = await owner.req("/api/uploads", { method: "POST", body: { projectId: kid, contentType: "image/png", size: PNG.length } });
await anon.storage.from("deliverables").uploadToSignedUrl(slot.json.path, slot.json.token, PNG, { contentType: "image/png" });
const d = await owner.req("/api/deliverables", { method: "POST", body: { projectId: kid, title: "Post", copy: "Hello", assetPath: slot.json.path } });
const { data: v1 } = await admin.from("versions").select("id").eq("deliverable_id", d.json?.id).single();
const ap = await asha.req(`/api/versions/${v1?.id}/approve`, { method: "POST", body: {} });
check("approver approves v1", ap.status === 200, `${ap.status} ${ap.text.slice(0, 120)}`);
const delKeep = await owner.req(`/api/projects/${kid}`, { method: "DELETE", body: { confirmName: `R7 Ledger ${stamp}` } });
check("project with approvals can't be deleted", delKeep.status === 409 && delKeep.json?.code === "has_approvals", `${delKeep.status} ${delKeep.text.slice(0, 120)}`);
await owner.req(`/api/projects/${kid}`, { method: "PATCH", body: { archived: true } });

// Removing a teammate
const rm = await owner.req(`/api/team/members/${creativeId}`, { method: "DELETE" });
check("owner removes the creative", rm.status === 200, `${rm.status}`);
const { data: left } = await admin.from("members").select("id").eq("user_id", creativeId);
check("creative is out of the workspace", left?.length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
