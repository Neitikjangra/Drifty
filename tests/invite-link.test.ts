import { describe, expect, it } from "vitest";
import { inviteTokenFrom } from "@/lib/invite-link";

describe("pasted invite link", () => {
  const t = "Abc_def-123456789012345678901234567890";
  it("finds the token in a full link, with text around it", () => {
    expect(inviteTokenFrom(`https://drifty-six.vercel.app/join/${t}`)).toBe(t);
    expect(inviteTokenFrom(`Hi! Your room: https://drifty-six.vercel.app/join/${t} thanks`)).toBe(t);
    expect(inviteTokenFrom(`  ${t}  `)).toBe(t);
  });
  it("rejects anything else", () => {
    expect(inviteTokenFrom("https://drifty-six.vercel.app/login")).toBeNull();
    expect(inviteTokenFrom("hello")).toBeNull();
  });
});
