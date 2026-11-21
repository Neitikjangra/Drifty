/** Pure Round 2 rules: status transitions and upload validation. Unit-tested. */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // PRD section 7: uploads at most 20 MB

export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export function isAllowedMime(m: string): m is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(m);
}

const EXT: Record<AllowedMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};
export const extFor = (m: AllowedMime) => EXT[m];

/** Checks the file's first bytes really match its declared type (don't trust the browser). */
export function sniffMime(head: Uint8Array): AllowedMime | null {
  const b = head;
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (starts(0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  return null;
}

export function validateUploadRequest(contentType: string, size: number): string | null {
  if (!isAllowedMime(contentType)) return "Upload an image (PNG, JPG, WebP, GIF) or a PDF.";
  if (!Number.isFinite(size) || size <= 0) return "That file is empty.";
  if (size > MAX_UPLOAD_BYTES) return "Files can be at most 20 MB.";
  return null;
}

// ------------------------------------------------------------ statuses

export type DeliverableStatus = "draft" | "in_review" | "changes_requested" | "approved";
/** Card statuses include "superseded" for older versions' cards. */
export type CardStatus = DeliverableStatus | "superseded";

/** Approver actions are allowed only on the current version while it's under review. */
export function canAct(
  action: "approve" | "request_changes",
  v: { isCurrent: boolean; deliverableStatus: DeliverableStatus },
): { ok: true } | { ok: false; reason: string } {
  if (!v.isCurrent) return { ok: false, reason: "A newer version exists. Review the latest card." };
  if (v.deliverableStatus === "approved") return { ok: false, reason: "This version is already approved." };
  if (action === "request_changes" && v.deliverableStatus === "changes_requested") {
    return { ok: false, reason: "Changes were already requested on this version." };
  }
  return { ok: true };
}

/** Next version number; new versions always go back to review. */
export function nextVersion(current: number): { number: number; status: DeliverableStatus } {
  return { number: current + 1, status: "in_review" };
}
