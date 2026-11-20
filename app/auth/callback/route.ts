import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/db/supabase-server";

/** Only same-site relative paths, so the link can't bounce users to another site. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

/**
 * Magic-link landing. Supports both Supabase flows:
 * PKCE (`?code=`) and email-template token hash (`?token_hash=&type=`).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const supabase = await supabaseServer();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  let reason = "no code or token_hash in link";
  if (tokenHash && type) {
    // Token-hash links are verified on the server: they work in any browser or app.
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
    reason = error ? `token_hash: ${error.code ?? error.status ?? "error"}` : "";
  } else if (code) {
    // PKCE links only work in the browser that asked for them (needs the verifier cookie).
    const hasVerifier = request.cookies.getAll().some((c) => c.name.includes("code-verifier"));
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    reason = error ? `pkce: ${error.code ?? error.status ?? "error"}${hasVerifier ? "" : " (no verifier cookie: opened in another browser/app)"}` : "";
  }
  // Log only the method and error code, never the email or token.
  if (!ok) console.warn(`[auth/callback] sign-in link failed: ${reason}`);

  return NextResponse.redirect(new URL(ok ? next : "/login?error=link", origin));
}
