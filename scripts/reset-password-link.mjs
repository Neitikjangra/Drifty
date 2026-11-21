// SUPPORT / OWNER TOOL: creates a one-time "choose a new password" link for an existing
// account, without sending any email. Use it while EMAIL_ENABLED is off, after you have
// confirmed the request really comes from that person (e.g. they emailed you from that address).
// The link works once and expires with Supabase's OTP expiry (default 1 hour).
// Usage: pnpm reset-link you@example.com            → link for the live site
//        pnpm reset-link you@example.com http://localhost:3000
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
const strip = (v) => v?.trim().replace(/^"(.*)"$/, "$1");
const email = process.argv[2]?.trim().toLowerCase();
const base = (process.argv[3] ?? strip(process.env.RESET_LINK_BASE_URL) ?? "https://drifty-six.vercel.app").replace(/\/+$/, "");

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: pnpm reset-link <email> [baseUrl]");
  process.exit(1);
}
const db = createClient(strip(process.env.NEXT_PUBLIC_SUPABASE_URL), strip(process.env.SUPABASE_SERVICE_ROLE_KEY), {
  auth: { persistSession: false },
});

// Only existing accounts: never create one here.
let found = false;
for (let page = 1; page <= 20 && !found; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("Couldn't look up users:", error.message);
    process.exit(1);
  }
  found = data.users.some((u) => u.email?.toLowerCase() === email);
  if (data.users.length < 200) break;
}
if (!found) {
  console.error("No Drifty account uses that email.");
  process.exit(1);
}

const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email });
if (error) {
  console.error("Couldn't create the reset link:", error.message);
  process.exit(1);
}
const link = `${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery&next=/auth/reset`;
console.log("\nOne-time reset link (works once, expires in about 1 hour). Open it, then choose a new password:\n");
console.log(link + "\n");
console.log("Only give this link to the account owner. It signs them in.");
