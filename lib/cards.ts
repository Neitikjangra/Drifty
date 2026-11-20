import { z } from "zod";

/** Deliverable status values (PRD section 6). */
export const DELIVERABLE_STATUSES = ["draft", "in_review", "changes_requested", "approved"] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

export const STATUS_LABEL: Record<DeliverableStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};

/** Content of a `drifty:deliverable` custom message (PRD section 6). */
export const deliverableCardSchema = z.object({
  deliverableId: z.string(),
  versionId: z.string(),
  version: z.number().int().positive(),
  title: z.string(),
  imageUrl: z.string(),
  copy: z.string(),
  dueDate: z.string().nullable(),
  status: z.enum(DELIVERABLE_STATUSES),
});
export type DeliverableCard = z.infer<typeof deliverableCardSchema>;

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
): DeliverableStatus {
  const raw =
    metadata instanceof Map ? metadata.get(META.status) : (metadata as Record<string, string> | undefined)?.[META.status];
  return (DELIVERABLE_STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as DeliverableStatus)
    : content.status;
}
