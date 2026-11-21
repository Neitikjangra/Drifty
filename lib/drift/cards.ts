import { z } from "zod";

/**
 * `drifty:drift` content (PRD section 6): posted in the internal room when vN+1 is held for
 * the drift check. Metadata (server-written): `status` = open|sent|back|superseded, `by`, `at`.
 */
export const driftCardSchema = z.object({
  alertId: z.string(),
  deliverableId: z.string(),
  title: z.string(),
  fromVersion: z.number(),
  toVersion: z.number(),
  toVersionId: z.string(),
  /** false when the AI couldn't run: every item is needs_check and a person decides. */
  aiChecked: z.boolean(),
  results: z.array(
    z.object({
      itemId: z.string(),
      text: z.string(),
      type: z.string(),
      verdict: z.enum(["done", "missing", "reversed", "needs_check"]),
      note: z.string(),
    }),
  ),
});
export type DriftCard = z.infer<typeof driftCardSchema>;
export type DriftCardStatus = "open" | "sent" | "back" | "superseded";
