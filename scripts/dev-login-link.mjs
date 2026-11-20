// DEV ONLY: prints a one-time localhost sign-in URL for a test agency user, without
// sending email. Uses the service-role key from .env.local. Never run against real users.
// Usage: node scripts/dev-login-link.mjs am.test@drifty.test [baseUrl]
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
const strip = (v) => v?.trim().replace(/^"(.*)"$/, "$1");
const email = process.argv[2];
const base = (process.argv[3] ?? "http://localhost:3000").replace(/\/+$/, "");
if (!email?.endsWith(".test")) {
  console.error("Use a test address ending in .test");
  process.exit(1);
}
if (!/^http:\/\/localhost(:\d+)?$/.test(base)) {
  console.error("Dev login links are only for localhost.");
  process.exit(1);
}
const db = createClient(strip(process.env.NEXT_PUBLIC_SUPABASE_URL), strip(process.env.SUPABASE_SERVICE_ROLE_KEY), {
  auth: { persistSession: false },
});
const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error("generateLink failed:", error.message);
  process.exit(1);
}
console.log(`${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/app`);
