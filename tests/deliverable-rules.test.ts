import { describe, expect, it } from "vitest";
import { canAct, MAX_UPLOAD_BYTES, nextVersion, sniffMime, validateUploadRequest } from "@/lib/deliverables/rules";
import { isProjectApprover, canUploadVersions } from "@/lib/auth/permissions";
import { resolveStatus } from "@/lib/cards";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("upload validation", () => {
  it("accepts images and PDF up to 20 MB only", () => {
    expect(validateUploadRequest("image/png", 1000)).toBeNull();
    expect(validateUploadRequest("application/pdf", MAX_UPLOAD_BYTES)).toBeNull();
    expect(validateUploadRequest("image/png", MAX_UPLOAD_BYTES + 1)).toMatch(/20 MB/);
    expect(validateUploadRequest("text/html", 10)).toMatch(/image/);
    expect(validateUploadRequest("image/svg+xml", 10)).toMatch(/image/);
    expect(validateUploadRequest("image/png", 0)).toMatch(/empty/);
  });

  it("checks real file signatures, not the declared type", () => {
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMime(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("application/pdf");
    expect(sniffMime(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("image/gif");
    expect(sniffMime(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp");
    expect(sniffMime(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
  });
});

describe("approver actions", () => {
  it("only on the current version, while under review", () => {
    expect(canAct("approve", { isCurrent: true, deliverableStatus: "in_review" }).ok).toBe(true);
    expect(canAct("approve", { isCurrent: true, deliverableStatus: "changes_requested" }).ok).toBe(true);
    expect(canAct("approve", { isCurrent: false, deliverableStatus: "in_review" }).ok).toBe(false);
    expect(canAct("approve", { isCurrent: true, deliverableStatus: "approved" }).ok).toBe(false);
    expect(canAct("request_changes", { isCurrent: true, deliverableStatus: "in_review" }).ok).toBe(true);
    expect(canAct("request_changes", { isCurrent: true, deliverableStatus: "changes_requested" }).ok).toBe(false);
  });

  it("a new version goes back to review", () => {
    expect(nextVersion(1)).toEqual({ number: 2, status: "in_review" });
  });

  it("only the named approver (a client) may approve", () => {
    const project = { approver_id: "g1" };
    expect(isProjectApprover({ kind: "guest", role: "approver", userId: "g1" }, project)).toBe(true);
    expect(isProjectApprover({ kind: "guest", role: "reviewer", userId: "g2" }, project)).toBe(false);
    expect(isProjectApprover({ kind: "guest", role: "approver", userId: "g2" }, project)).toBe(false);
    expect(isProjectApprover({ kind: "member", role: "owner", userId: "g1" }, project)).toBe(false);
  });

  it("creatives can upload versions; card status includes superseded", () => {
    expect(canUploadVersions("creative")).toBe(true);
    expect(resolveStatus({ status: "in_review" }, { status: "superseded" })).toBe("superseded");
  });
});
