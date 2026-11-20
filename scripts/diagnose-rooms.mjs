// Checks, via the Nexconn Platform Chat API, that every client guest is a member of
// their project's client room and NOT of the internal room. Read-only.
// Prints names and roles only; Nexconn ids are masked.
// Usage: node scripts/diagnose-rooms.mjs [name filter]
import { createHash, randomInt } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
const strip = (v) => v?.trim().replace(/^"(.*)"$/, "$1");
const appKey = strip(process.env.NEXT_PUBLIC_NEXCONN_APP_KEY);
const secret = strip(process.env.NEXCONN_APP_SECRET);
const host = (strip(process.env.NEXCONN_API_BASE) || "api.sg-light-api.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const db = createClient(strip(process.env.NEXT_PUBLIC_SUPABASE_URL), strip(process.env.SUPABASE_SERVICE_ROLE_KEY), {
  auth: { persistSession: false },
});
const filter = (process.argv[2] ?? "").toLowerCase();
const mask = (id) => (id ? `${id.slice(0, 3)}…${id.slice(-3)}` : "-");

async function nexconn(path, body) {
  const nonce = String(randomInt(1, 2 ** 47));
  const ts = String(Date.now());
  const sig = createHash("sha1").update(secret + nonce + ts).digest("hex");
  const res = await fetch(`https://${host}${path}`, {
    method: "POST",
    headers: { "App-Key": appKey, Nonce: nonce, Timestamp: ts, Signature: sig, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function members(channelId) {
  const ids = new Set();
  let pageToken;
  for (let i = 0; i < 20; i++) {
    const r = await nexconn("/v4/group-channel/member/list", { channelId, pageSize: 100, ...(pageToken ? { pageToken } : {}) });
    if (r.code !== 0) return { error: r.code };
    const list = r.members ?? r.result?.members ?? [];
    list.forEach((m) => ids.add(m.userId));
    pageToken = r.pageToken ?? r.result?.pageToken;
    if (!pageToken) break;
  }
  return { ids };
}

const { data: projects } = await db.from("projects").select("id, client_name, client_channel_id, internal_channel_id").eq("archived", false);
let problems = 0;
for (const p of projects ?? []) {
  const { data: guests } = await db
    .from("project_guests")
    .select("role, user_id, profiles(display_name, nexconn_user_id)")
    .eq("project_id", p.id);
  const relevant = (guests ?? []).filter((g) => !filter || (g.profiles?.display_name ?? "").toLowerCase().includes(filter));
  if (filter && !relevant.length) continue;
  const client = await members(p.client_channel_id);
  const internal = await members(p.internal_channel_id);
  console.log(`\nProject "${p.client_name}"`);
  console.log(`  client room: ${client.error ? `API error ${client.error}` : `${client.ids.size} members`} | internal room: ${internal.error ? `API error ${internal.error}` : `${internal.ids.size} members`}`);
  for (const g of relevant) {
    const nid = g.profiles?.nexconn_user_id;
    const inClient = client.ids?.has(nid);
    const inInternal = internal.ids?.has(nid);
    const ok = inClient && !inInternal;
    if (!ok) problems++;
    console.log(
      `  ${ok ? "OK " : "BAD"} ${g.profiles?.display_name ?? "?"} (${g.role}, nexconn ${mask(nid)}): client room ${inClient ? "YES" : "NO"}, internal room ${inInternal ? "YES (must be NO)" : "no"}`,
    );
  }
}
console.log(`\n${problems ? `${problems} problem(s) found` : "All clients are in their client room and none are in an internal room."}`);
