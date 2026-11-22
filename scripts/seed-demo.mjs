// Adds the demo project (Sunrise Cafe) to an agency's workspace through the real app, the same
// as the "Try the demo project" button. LOCAL ONLY: signs in with a one-time link (no email sent).
// Usage: pnpm seed:demo <agency-email> [http://localhost:3101]
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
const strip = (v) => v?.trim().replace(/^"(.*)"$/, "$1");
const email = process.argv[2];
const base = (process.argv[3] ?? "http://localhost:3101").replace(/\/+$/, "");
if (!email) {
  console.error("Usage: pnpm seed:demo <agency-email> [baseUrl]");
  process.exit(1);
}
if (!/^http:\/\/localhost(:\d+)?$/.test(base)) {
  console.error("This script only runs against a local server. In production use the in-app 'Try the demo project' button.");
  process.exit(1);
}
const db = createClient(strip(process.env.NEXT_PUBLIC_SUPABASE_URL), strip(process.env.SUPABASE_SERVICE_ROLE_KEY), { auth: { persistSession: false } });
const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error("Couldn't sign in as that user:", error.message);
  process.exit(1);
}
const signIn = await fetch(`${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/app`, { redirect: "manual" });
const cookie = signIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const res = await fetch(`${base}/api/demo`, { method: "POST", headers: { cookie } });
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Failed (${res.status}): ${body.error ?? "unknown error"}`);
  process.exit(1);
}
console.log(`${body.existing ? "Already had a demo" : "Demo project added"}: ${base}/app/projects/${body.projectId}`);
