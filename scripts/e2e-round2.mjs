// End-to-end check of Round 2 (deliverables, versions, approvals) against a LOCAL server.
// Uses a fixed test agency (e2e-r2@drifty.test). Approvals are insert-only, so this run's
// project and approvals are kept (they can't be deleted by design).
// Usage: node scripts/e2e-round2.mjs [http://localhost:3100]
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
const BASE = (process.argv[2] ?? "http://localhost:3100").replace(/\/+$/, "");
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
  async req(path, { method = "GET", body, follow = false } = {}) {
    let url = path.startsWith("http") ? path : BASE + path;
    for (let hops = 0; hops < 6; hops++) {
      const res = await fetch(url, {
        method,
        redirect: "manual",
        headers: { cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "), ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
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
      return { status: res.status, location: loc, json, text, url };
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

// A real 1x1 PNG, and a second one (different bytes → different hash).
const PNG1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const PNG2 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const sha = (b) => createHash("sha256").update(b).digest("hex");

async function upload(b, projectId, bytes, contentType = "image/png") {
  const slot = await b.req("/api/uploads", { method: "POST", body: { projectId, contentType, size: bytes.length } });
  if (slot.status !== 201) return { slot };
  const { error } = await anon.storage.from("deliverables").uploadToSignedUrl(slot.json.path, slot.json.token, bytes, { contentType });
  return { slot, path: slot.json.path, error };
}

const stamp = Date.now().toString(36);
const am = new Browser();
const approver = new Browser();
const reviewer = new Browser();
const stranger = new Browser();
console.log(`E2E Round 2 against ${BASE}\n`);

// Setup: agency, project, approver + reviewer
await signIn(am, "e2e-r2@drifty.test");
await am.req("/api/onboarding", { method: "POST", body: { workspaceName: "E2E Round 2 Agency (test)", displayName: "R2 AM" } });
await admin.from("workspaces").update({ plan: "pilot" }).eq("name", "E2E Round 2 Agency (test)"); // test agency: no Free-plan client limit
const proj = await am.req("/api/projects", { method: "POST", body: { clientName: `R2 campaign ${stamp}` } });
check("setup: project created", proj.status === 201, `${proj.status} ${proj.text.slice(0, 120)}`);
const projectId = proj.json?.id;
const invA = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "approver@r2.test", name: "R2 Approver", role: "approver" } });
const invR = await am.req("/api/invites", { method: "POST", body: { projectId, emailOrPhone: "reviewer@r2.test", name: "R2 Reviewer", role: "reviewer" } });
await approver.req(`/api/join/${invA.json.link.split("/join/")[1]}`, { method: "POST", body: { name: "R2 Approver" } });
await reviewer.req(`/api/join/${invR.json.link.split("/join/")[1]}`, { method: "POST", body: { name: "R2 Reviewer" } });
check("setup: approver and reviewer joined", approver.jar.has("drifty_guest") && reviewer.jar.has("drifty_guest"));

// Uploads
const badType = await am.req("/api/uploads", { method: "POST", body: { projectId, contentType: "text/html", size: 100 } });
check("upload refuses non-image/PDF types", badType.status === 400, `${badType.status}`);
const tooBig = await am.req("/api/uploads", { method: "POST", body: { projectId, contentType: "image/png", size: 21 * 1024 * 1024 } });
check("upload refuses files over 20 MB", tooBig.status === 400, `${tooBig.status}`);
const guestUpload = await approver.req("/api/uploads", { method: "POST", body: { projectId, contentType: "image/png", size: 100 } });
check("clients can't upload drafts", guestUpload.status === 403, `${guestUpload.status}`);
const fake = await upload(am, projectId, Buffer.from("<html>not an image</html>"));
const fakeDel = await am.req("/api/deliverables", { method: "POST", body: { projectId, title: "Fake", copy: "", assetPath: fake.path } });
check("a file pretending to be PNG is rejected", fakeDel.status === 400, `${fakeDel.status} ${fakeDel.text.slice(0, 100)}`);
const foreign = await am.req("/api/deliverables", { method: "POST", body: { projectId, title: "X", copy: "", assetPath: `00000000-0000-4000-8000-000000000000/x.png` } });
check("can't attach a file from another project", foreign.status === 400, `${foreign.status}`);

// FR-4: v1 card
const up1 = await upload(am, projectId, PNG1);
check("direct upload to private bucket works", !up1.error && Boolean(up1.path), up1.error?.message);
const copy1 = "Light up your Diwali with 20% off.";
const del = await am.req("/api/deliverables", {
  method: "POST",
  body: { projectId, title: "Diwali post 1", copy: copy1, dueDate: "2026-11-25", assetPath: up1.path },
});
check("AM posts deliverable v1 → 201", del.status === 201, `${del.status} ${del.text.slice(0, 160)}`);
const dId = del.json?.id;
const v1 = del.json?.versionId;
const { data: v1row } = await admin.from("versions").select("number, asset_sha256, card_message_id, copy_text").eq("id", v1).single();
check("v1 stored with SHA-256 of the exact file", v1row?.asset_sha256 === sha(PNG1));
check("v1 card posted to Nexconn (message id saved)", Boolean(v1row?.card_message_id));
const { data: d1 } = await admin.from("deliverables").select("status, current_version").eq("id", dId).single();
check("deliverable starts In review at v1", d1?.status === "in_review" && d1?.current_version === 1);

// Asset access
const asApprover = await approver.req(`/api/assets/${v1}`);
check("client of the project can view the draft (signed URL redirect)", asApprover.status === 302 && /token=/.test(asApprover.location ?? ""), `${asApprover.status}`);
check("anonymous can't view the draft", (await stranger.req(`/api/assets/${v1}`)).status === 401);
const bucketPublic = await anon.storage.from("deliverables").createSignedUrl(up1.path, 60);
check("anon key alone can't read the private bucket", Boolean(bucketPublic.error), "signed URL was created with the anon key");

// FR-5: only the approver acts
check("reviewer can't approve", (await reviewer.req(`/api/versions/${v1}/approve`, { method: "POST" })).status === 403);
check("AM can't approve for the client", (await am.req(`/api/versions/${v1}/approve`, { method: "POST" })).status === 403);
check("anonymous can't approve", (await stranger.req(`/api/versions/${v1}/approve`, { method: "POST" })).status === 401);
const rc = await approver.req(`/api/versions/${v1}/request-changes`, { method: "POST", body: { note: "Make the logo bigger" } });
check("approver requests changes with a note", rc.status === 200, `${rc.status} ${rc.text.slice(0, 120)}`);
const { data: d2 } = await admin.from("deliverables").select("status").eq("id", dId).single();
check("status → Changes requested", d2?.status === "changes_requested");
const rc2 = await approver.req(`/api/versions/${v1}/request-changes`, { method: "POST", body: {} });
check("can't request changes twice on the same version", rc2.status === 409, `${rc2.status}`);

// FR-10: v2 supersedes v1
check("clients can't upload a new version", (await approver.req(`/api/deliverables/${dId}/versions`, { method: "POST", body: { copy: "", assetPath: up1.path } })).status === 403);
const up2 = await upload(am, projectId, PNG2);
const copy2 = "Light up your Diwali with 20% off. Shop now!";
const ver2 = await am.req(`/api/deliverables/${dId}/versions`, { method: "POST", body: { copy: copy2, assetPath: up2.path } });
check("AM uploads v2 → 201", ver2.status === 201 && ver2.json?.version === 2, `${ver2.status} ${ver2.text.slice(0, 160)}`);
const v2 = ver2.json?.versionId;
const { data: d3 } = await admin.from("deliverables").select("status, current_version").eq("id", dId).single();
check("deliverable back to In review at v2", d3?.status === "in_review" && d3?.current_version === 2);
const old = await approver.req(`/api/versions/${v1}/approve`, { method: "POST" });
check("approving the superseded v1 is refused", old.status === 409, `${old.status}`);

// FR-13 core: approval row
const ok2 = await approver.req(`/api/versions/${v2}/approve`, { method: "POST" });
check("approver approves v2", ok2.status === 200, `${ok2.status} ${ok2.text.slice(0, 160)}`);
const { data: appr } = await admin.from("approvals").select("id, approver_id, copy_snapshot, asset_sha256, approved_at").eq("version_id", v2).single();
check("approval row has exact copy snapshot", appr?.copy_snapshot === copy2);
check("approval row has the asset SHA-256 of v2", appr?.asset_sha256 === sha(PNG2));
check("approval row has approver + timestamp", Boolean(appr?.approver_id && appr?.approved_at));
const { data: d4 } = await admin.from("deliverables").select("status").eq("id", dId).single();
check("deliverable status Approved", d4?.status === "approved");
const again = await approver.req(`/api/versions/${v2}/approve`, { method: "POST" });
check("double approve refused (one ledger row)", again.status === 409, `${again.status}`);
const v3 = await am.req(`/api/deliverables/${dId}/versions`, { method: "POST", body: { copy: "", assetPath: up2.path } });
check("no new versions after approval", v3.status === 409, `${v3.status}`);

// NFR-4: ledger is insert-only, even for the service role
const upd = await admin.from("approvals").update({ copy_snapshot: "tampered" }).eq("id", appr.id).select();
check("approval rows can't be edited (even with service role)", Boolean(upd.error), "update succeeded");
const delRow = await admin.from("approvals").delete().eq("id", appr.id).select();
check("approval rows can't be deleted (even with service role)", Boolean(delRow.error), "delete succeeded");
const { data: still } = await admin.from("approvals").select("copy_snapshot").eq("id", appr.id).single();
check("approval row unchanged", still?.copy_snapshot === copy2);

// Project page shows the deliverable
const page = await am.req(`/app/projects/${projectId}`);
check("project page lists the deliverable as Approved", page.status === 200 && page.text.includes("Diwali post 1") && page.text.includes("Approved"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
