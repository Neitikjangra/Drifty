import { describe, expect, it } from "vitest";
import { seesAllProjects, teamDiff, teamInviteState, teamTokenText } from "@/lib/team/rules";

describe("team", () => {
  const base = { expires_at: "2026-12-01T00:00:00Z", revoked_at: null, used_at: null };
  const now = Date.parse("2026-11-23T00:00:00Z");
  it("team links work once, until revoked or expired", () => {
    expect(teamInviteState(base, now)).toBe("ok");
    expect(teamInviteState({ ...base, used_at: "2026-11-22T00:00:00Z" }, now)).toBe("used");
    expect(teamInviteState({ ...base, revoked_at: "2026-11-22T00:00:00Z" }, now)).toBe("revoked");
    expect(teamInviteState({ ...base, expires_at: "2026-11-22T00:00:00Z" }, now)).toBe("expired");
  });
  it("only creatives are limited to their projects", () => {
    expect(seesAllProjects("owner")).toBe(true);
    expect(seesAllProjects("am")).toBe(true);
    expect(seesAllProjects("creative")).toBe(false);
  });
  it("team changes become room joins and leaves", () => {
    expect(teamDiff(["a", "b"], ["b", "c"])).toEqual({ add: ["c"], remove: ["a"] });
    expect(teamDiff([], [])).toEqual({ add: [], remove: [] });
  });
  it("team tokens can't be confused with client invite tokens", () => {
    expect(teamTokenText("abc")).toBe("team:abc");
  });
});
