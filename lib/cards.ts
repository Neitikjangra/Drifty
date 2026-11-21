import { z } from "zod";

/** Deliverable status values (PRD section 6). */
export const DELIVERABLE_STATUSES = ["draft", "in_review", "changes_requested", "approved"] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

/** A card can also be "superseded" once a newer version is posted. */
export const CARD_STATUSES = [...DELIVERABLE_STATUSES, "superseded"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const STATUS_LABEL: Record<CardStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  superseded: "Superseded",
};

/** Content of a `drifty:deliverable` custom message (PRD section 6). */
export const deliverableCardSchema = z.object({
  deliverableId: z.string(),
  versionId: z.string(),
  version: z.number().int().positive(),
  title: z.string(),
  /** Same-origin, access-checked URL (/api/assets/:versionId); never a public bucket URL. */
  imageUrl: z.string(),
  copy: z.string(),
  dueDate: z.string().nullable(),
  status: z.enum(CARD_STATUSES),
  /** Added in Round 2 so PDFs render as a file link instead of an image. */
  assetKind: z.enum(["image", "pdf"]).optional(),
});
export type DeliverableCard = z.infer<typeof deliverableCardSchema>;

/** Content of a `drifty:receipt` custom message (PRD section 6). */
export const receiptCardSchema = z.object({
  versionId: z.string(),
  version: z.number().int().positive().optional(),
  title: z.string().optional(),
  approver: z.string(),
  approvedAt: z.string(),
});
export type ReceiptCard = z.infer<typeof receiptCardSchema>;

/** Metadata keys the server writes on a card. Clients only read them. */
export const META = {
  status: "status",
  actedBy: "actedBy",
  actedAt: "actedAt",
} as const;

/**
 * Live status = server-written metadata if present and valid, else the status
 * the card was posted with.
 */
export function resolveStatus(
  content: Pick<DeliverableCard, "status">,
  metadata: ReadonlyMap<string, string> | Record<string, string> | undefined,
): CardStatus {
  const raw =
    metadata instanceof Map ? metadata.get(META.status) : (metadata as Record<string, string> | undefined)?.[META.status];
  return (CARD_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as CardStatus) : content.status;
}
