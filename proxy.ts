import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session cookie and sends signed-out visitors of /app to
 * /login. This is only an optimistic gate: every page and route re-checks access
 * on the server.
 */
export async function proxy(request: NextRequest) {
  // Supabase falls back to the Site URL (e.g. "/?code=…") when the callback isn't in its
  // allowed redirect list. Send those sign-in links to our callback instead of losing them.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && (searchParams.has("code") || searchParams.has("token_hash"))) {
    const callback = request.nextUrl.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user && request.nextUrl.pathname.startsWith("/app")) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/", "/app/:path*", "/login", "/auth/:path*"],
};
