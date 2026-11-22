import { supabaseServer } from "@/lib/db/supabase-server";

/** Relative redirect: always stays on the host the browser used (no server-host guessing). */
const seeOther = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

/** Only an invite link may be the next stop (no open redirects). */
const safeNext = (v: string | null) => (v && /^\/join\/[A-Za-z0-9_-]{10,200}$/.test(v) ? v : "/login");

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return seeOther(safeNext(new URL(req.url).searchParams.get("next")));
}
