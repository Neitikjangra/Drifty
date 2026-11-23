import { describe, expect, it } from "vitest";
import { canGrant, JOB_ROLES, jobRole, roleLabel, seesAllProjects, teamDiff, teamInviteState, teamTokenText } from "@/lib/team/rules";

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


describe("job roles", () => {
  it("every role maps to an access level", () => {
    expect(JOB_ROLES.length).toBeGreaterThanOrEqual(10);
    expect(jobRole("designer")?.access).toBe("creative");
    expect(jobRole("project_manager")?.access).toBe("am");
    expect(jobRole("nope")).toBeNull();
  });
  it("labels prefer the job role", () => {
    expect(roleLabel("creative", "video_editor")).toBe("Video editor");
    expect(roleLabel("am", "")).toBe("Account manager");
    expect(roleLabel("owner", "designer")).toBe("Owner");
  });
  it("only the owner grants manager access", () => {
    expect(canGrant("owner", "am")).toBe(true);
    expect(canGrant("am", "am")).toBe(false);
    expect(canGrant("am", "creative")).toBe(true);
    expect(canGrant("creative", "creative")).toBe(false);
  });
});
