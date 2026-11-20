import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Invite links and guest sessions are signed with MAGIC_LINK_SIGNING_SECRET.
 * Pure functions (secret passed in) so they can be unit-tested.
 */

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const GUEST_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const b64url = (buf: Buffer) => buf.toString("base64url");

/** A fresh invite token (256 random bits) and the hash we store. The token is never stored. */
export function newInviteToken(secret: string): { token: string; hash: string } {
  const token = b64url(randomBytes(32));
  return { token, hash: hashInviteToken(secret, token) };
}

/** Keyed hash, so a leaked table can't be used to forge or look up links. */
export function hashInviteToken(secret: string, token: string): string {
  return createHmac("sha256", secret).update(`invite:${token}`).digest("hex");
}

export function isWellFormedInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type InviteState = "ok" | "expired" | "revoked" | "used";

export function inviteState(
  invite: { expires_at: string; revoked_at: string | null; used_at: string | null },
  now: number = Date.now(),
): InviteState {
  if (invite.revoked_at) return "revoked";
  if (invite.used_at) return "used";
  if (new Date(invite.expires_at).getTime() <= now) return "expired";
  return "ok";
}

// ------------------------------------------------------------ guest session

export interface GuestSession {
  /** profiles.user_id of the guest */
  guestId: string;
  /** expiry, ms since epoch */
  exp: number;
}

export function signGuestSession(secret: string, s: GuestSession): string {
  const body = b64url(Buffer.from(JSON.stringify({ g: s.guestId, e: s.exp })));
  const sig = b64url(createHmac("sha256", secret).update(`guest:${body}`).digest());
  return `${body}.${sig}`;
}

export function verifyGuestSession(
  secret: string,
  value: string | undefined,
  now: number = Date.now(),
): GuestSession | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(`guest:${body}`).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { g?: unknown; e?: unknown };
    if (typeof parsed.g !== "string" || typeof parsed.e !== "number") return null;
    if (parsed.e <= now) return null;
    if (!/^[0-9a-f-]{36}$/.test(parsed.g)) return null;
    return { guestId: parsed.g, exp: parsed.e };
  } catch {
    return null;
  }
}
