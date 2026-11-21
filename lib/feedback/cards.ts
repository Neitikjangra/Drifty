import { z } from "zod";

/** `drifty:changelist` content (PRD section 6) + what each item needs to be checked in one tap. */
export const changeListCardSchema = z.object({
  changeListId: z.string(),
  deliverableId: z.string(),
  versionId: z.string(),
  version: z.number(),
  title: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      type: z.string(),
      author: z.string(),
      sourceMsgId: z.string(),
      /** The client's own words (or voice transcript) this item came from. */
      source: z.string(),
      status: z.string(),
    }),
  ),
});
export type ChangeListCard = z.infer<typeof changeListCardSchema>;

/** `drifty:conflict` content (PRD section 6). */
export const conflictCardSchema = z.object({
  conflictId: z.string(),
  deliverableId: z.string(),
  title: z.string(),
  version: z.number(),
  summary: z.string(),
  optionA: z.object({ text: z.string(), author: z.string() }),
  optionB: z.object({ text: z.string(), author: z.string() }),
});
export type ConflictCard = z.infer<typeof conflictCardSchema>;

/**
 * Card metadata (server-written): per change-list item `i<index>` = JSON {s: status, t?: edited text};
 * `brief` = ISO time the brief was sent; conflicts: `status` = open|resolved, `choice`, `by`.
 * Keys follow Nexconn rules (<= 32 chars, letters/digits).
 */
export const itemKey = (index: number) => `i${index}`;
export interface ItemMeta {
  s: string;
  t?: string;
}
export function readItemMeta(meta: Record<string, string>, index: number): ItemMeta | null {
  const raw = meta[itemKey(index)];
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as ItemMeta;
    return typeof v.s === "string" ? v : null;
  } catch {
    return null;
  }
}
