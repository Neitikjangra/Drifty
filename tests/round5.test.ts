import { describe, expect, it } from "vitest";
import { canAddClient, clientLimit, FREE_ACTIVE_CLIENTS } from "@/lib/plans";
import { DEMO } from "@/lib/demo/content";

describe("plans", () => {
  it("Free = 2 active clients; other plans unlimited", () => {
    expect(FREE_ACTIVE_CLIENTS).toBe(2);
    expect(clientLimit("free")).toBe(2);
    expect(clientLimit("pilot")).toBeNull();
    expect(canAddClient("free", 1)).toBe(true);
    expect(canAddClient("free", 2)).toBe(false);
    expect(canAddClient("pilot", 50)).toBe(true);
  });
});

describe("demo content", () => {
  it("has an approver and a reviewer who disagree, plus a copy change for the drift check", () => {
    expect(DEMO.people.map((p) => p.role).sort()).toEqual(["approver", "reviewer"]);
    expect(DEMO.feedback.some((f) => /bada|bigger/i.test(f.text))).toBe(true); // Hinglish: "bada" = bigger
    expect(DEMO.feedback.some((f) => /smaller/i.test(f.text))).toBe(true);
    // v2 keeps the old CTA (so the drift check flags it); v3 fixes it.
    expect(DEMO.v2.copy).toContain("Buy now");
    expect(DEMO.v3.copy).toContain("Order now");
  });
});
