import { supabaseServer } from "@/lib/db/supabase-server";

/** Relative redirect: always stays on the host the browser used (no server-host guessing). */
const seeOther = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

export async function POST() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return seeOther("/login");
}
