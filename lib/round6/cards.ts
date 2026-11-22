import { z } from "zod";

/**
 * `drifty:approvalcheck` (client room, FR-16): "Does this approve all of vX?" after a vague
 * "ok"/👍 outside the card. Metadata: `status` open|yes|no, `by`.
 */
export const approvalCheckCardSchema = z.object({
  alertId: z.string(),
  deliverableId: z.string(),
  versionId: z.string(),
  version: z.number(),
  title: z.string(),
  /** The approver's own words that triggered the question. */
  quote: z.string(),
  approver: z.string(),
});
export type ApprovalCheckCard = z.infer<typeof approvalCheckCardSchema>;

/**
 * `drifty:scope` (internal room, FR-15): rounds used vs included, with a draft client note
 * the AM can edit, send or discard. Metadata: `status` open|sent|discarded, `by`, `text`.
 */
export const scopeCardSchema = z.object({
  alertId: z.string(),
  deliverableId: z.string(),
  title: z.string(),
  roundsUsed: z.number(),
  roundsIncluded: z.number(),
  state: z.enum(["at_limit", "over"]),
  draft: z.string(),
});
export type ScopeCard = z.infer<typeof scopeCardSchema>;
