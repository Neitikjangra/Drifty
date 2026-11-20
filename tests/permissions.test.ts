import { describe, expect, it } from "vitest";
import { allowedRooms, canManageProjects, joinsClientRoom } from "@/lib/auth/permissions";
import { roomIds } from "@/lib/nexconn/rooms";
import { isValidNexconnId } from "@/lib/nexconn/ids";

describe("permissions", () => {
  it("only owners and AMs manage projects and invites", () => {
    expect(canManageProjects("owner")).toBe(true);
    expect(canManageProjects("am")).toBe(true);
    expect(canManageProjects("creative")).toBe(false);
    expect(canManageProjects(null)).toBe(false);
  });

  it("clients never get the internal room", () => {
    expect(allowedRooms({ kind: "guest", role: "approver" })).toEqual({ client: true, internal: false });
    expect(allowedRooms({ kind: "guest", role: "reviewer" })).toEqual({ client: true, internal: false });
  });

  it("agency rooms by role", () => {
    expect(allowedRooms({ kind: "member", role: "owner" })).toEqual({ client: true, internal: true });
    expect(allowedRooms({ kind: "member", role: "creative" })).toEqual({ client: false, internal: true });
    expect(joinsClientRoom("am")).toBe(true);
  });
});

describe("room ids", () => {
  it("are distinct, stable and valid Nexconn ids", () => {
    const ids = roomIds("3f2b8c1e-1234-4abc-9def-0123456789ab");
    expect(ids.client).toBe("c3f2b8c1e12344abc9def0123456789ab");
    expect(ids.internal).toBe("i3f2b8c1e12344abc9def0123456789ab");
    expect(isValidNexconnId(ids.client) && isValidNexconnId(ids.internal)).toBe(true);
  });
});
