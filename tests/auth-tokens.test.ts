import { describe, expect, it } from "vitest";
import {
  GUEST_SESSION_TTL_MS,
  hashInviteToken,
  INVITE_TTL_MS,
  inviteState,
  isWellFormedInviteToken,
  newInviteToken,
  signGuestSession,
  verifyGuestSession,
} from "@/lib/auth/tokens";

const SECRET = "s".repeat(64);
const GUEST = "3f2b8c1e-1234-4abc-9def-0123456789ab";

describe("invite tokens", () => {
  it("are random, well-formed, and stored only as a keyed hash", () => {
    const a = newInviteToken(SECRET);
    const b = newInviteToken(SECRET);
    expect(a.token).not.toBe(b.token);
    expect(isWellFormedInviteToken(a.token)).toBe(true);
    expect(a.hash).toBe(hashInviteToken(SECRET, a.token));
    expect(a.hash).not.toContain(a.token);
    expect(hashInviteToken("other-secret".padEnd(64, "x"), a.token)).not.toBe(a.hash);
  });

  it("rejects malformed tokens before any lookup", () => {
    expect(isWellFormedInviteToken("short")).toBe(false);
    expect(isWellFormedInviteToken("a".repeat(42) + "!")).toBe(false);
  });

  it("expire after 7 days, and revoked/used links never work", () => {
    expect(INVITE_TTL_MS).toBe(7 * 24 * 3600 * 1000);
    const now = Date.parse("2026-11-20T10:00:00Z");
    const base = { expires_at: "2026-11-27T10:00:00Z", revoked_at: null, used_at: null };
    expect(inviteState(base, now)).toBe("ok");
    expect(inviteState(base, Date.parse("2026-11-27T10:00:00Z"))).toBe("expired");
    expect(inviteState({ ...base, revoked_at: "2026-11-21T00:00:00Z" }, now)).toBe("revoked");
    expect(inviteState({ ...base, used_at: "2026-11-21T00:00:00Z" }, now)).toBe("used");
  });
});

describe("guest session cookie", () => {
  const now = Date.parse("2026-11-20T10:00:00Z");

  it("round-trips a valid session", () => {
    const value = signGuestSession(SECRET, { guestId: GUEST, exp: now + GUEST_SESSION_TTL_MS });
    expect(verifyGuestSession(SECRET, value, now)).toEqual({ guestId: GUEST, exp: now + GUEST_SESSION_TTL_MS });
  });

  it("rejects tampering, wrong secret, expiry and junk", () => {
    const value = signGuestSession(SECRET, { guestId: GUEST, exp: now + 1000 });
    const [body, sig] = value.split(".");
    const forged = Buffer.from(JSON.stringify({ g: "00000000-0000-4000-8000-000000000000", e: now + 1000 })).toString("base64url");
    expect(verifyGuestSession(SECRET, `${forged}.${sig}`, now)).toBeNull();
    expect(verifyGuestSession("x".repeat(64), value, now)).toBeNull();
    expect(verifyGuestSession(SECRET, value, now + 1000)).toBeNull();
    expect(verifyGuestSession(SECRET, `${body}`, now)).toBeNull();
    expect(verifyGuestSession(SECRET, undefined, now)).toBeNull();
    expect(verifyGuestSession(SECRET, "garbage.value", now)).toBeNull();
  });
});
