import "server-only";
import { cookies } from "next/headers";
import { signingSecret } from "@/lib/env";
import { supabaseServer } from "@/lib/db/supabase-server";
import { GUEST_SESSION_TTL_MS, signGuestSession, verifyGuestSession } from "./tokens";

export const GUEST_COOKIE = "drifty_guest";

/** The signed-in agency user (Supabase session), or null. Verified with Supabase, not just decoded. */
export async function getAgencyUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** The client guest from the signed cookie, or null. */
export async function getGuestId(): Promise<string | null> {
  const store = await cookies();
  const session = verifyGuestSession(signingSecret(), store.get(GUEST_COOKIE)?.value);
  return session?.guestId ?? null;
}

export async function setGuestCookie(guestId: string) {
  const store = await cookies();
  const exp = Date.now() + GUEST_SESSION_TTL_MS;
  store.set(GUEST_COOKIE, signGuestSession(signingSecret(), { guestId, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
}
