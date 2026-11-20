import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdminEnv, supabaseEnv } from "@/lib/env";

/** Supabase client bound to the signed-in user's session cookies (RLS applies). */
export async function supabaseServer() {
  // Sessions are per request; tell Next not to prerender anything that reads them.
  await connection();
  const env = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; proxy refreshes them.
        }
      },
    },
  });
}

/** Service-role client. Server only; bypasses RLS, so callers must check permissions first. */
export function supabaseAdmin() {
  const env = supabaseAdminEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
