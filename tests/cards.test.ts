import { describe, expect, it } from "vitest";
import { deliverableCardSchema, resolveStatus } from "@/lib/cards";
import { isValidNexconnId, MSG, nexconnUserId } from "@/lib/nexconn/ids";

describe("resolveStatus", () => {
  const content = { status: "in_review" as const };

  it("prefers server-written metadata", () => {
    expect(resolveStatus(content, new Map([["status", "approved"]]))).toBe("approved");
    expect(resolveStatus(content, { status: "changes_requested" })).toBe("changes_requested");
  });

  it("falls back to the posted status when metadata is missing or invalid", () => {
    expect(resolveStatus(content, undefined)).toBe("in_review");
    expect(resolveStatus(content, new Map())).toBe("in_review");
    expect(resolveStatus(content, { status: "hacked" })).toBe("in_review");
  });
});

describe("deliverable card schema", () => {
  it("accepts the PRD content shape and rejects bad status", () => {
    const card = {
      deliverableId: "d1",
      versionId: "v1",
      version: 1,
      title: "Post",
      imageUrl: "/x.png",
      copy: "Hi",
      dueDate: null,
      status: "in_review",
    };
    expect(deliverableCardSchema.safeParse(card).success).toBe(true);
    expect(deliverableCardSchema.safeParse({ ...card, status: "done" }).success).toBe(false);
  });
});

describe("Nexconn ids", () => {
  it("derives an alphanumeric user id from a uuid", () => {
    const id = nexconnUserId("3f2b8c1e-1234-4abc-9def-0123456789ab");
    expect(id).toBe("u3f2b8c1e12344abc9def0123456789ab");
    expect(isValidNexconnId(id)).toBe(true);
  });

  it("rejects ids with other characters", () => {
    expect(() => nexconnUserId("bad id!")).toThrow();
    expect(isValidNexconnId("a".repeat(65))).toBe(false);
  });

  it("keeps custom message types within Nexconn limits", () => {
    for (const t of Object.values(MSG)) {
      expect(t.length).toBeLessThanOrEqual(32);
      expect(t.startsWith("RC:") || t.startsWith("NC:")).toBe(false);
    }
  });
});
