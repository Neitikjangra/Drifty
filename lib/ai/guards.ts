import type { ChangeListOutput, ConflictsOutput, DriftOutput, DriftVerdict } from "./schemas";

/** PRD section 6 guards, as pure functions (unit-tested). */

export const MAX_MESSAGES = 200;
export const LOW_CONFIDENCE = 0.5;

export interface FeedbackMessage {
  id: string;
  authorId: string;
  authorName: string;
  role: string;
  text: string;
  replyTo?: string | null;
  sentAt: string;
}

/** Keep only the last 200 messages (cost and prompt-size cap). */
export function capMessages<T extends { sentAt: string }>(msgs: T[]): T[] {
  const sorted = [...msgs].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  return sorted.slice(-MAX_MESSAGES);
}

/**
 * Cleans AI-1 output: every item must point at real messages (by real authors), and
 * low-confidence items become questions instead of being guessed (SRS AI rules).
 */
export function sanitizeItems(out: ChangeListOutput, msgs: FeedbackMessage[]): ChangeListOutput["items"] {
  const byId = new Map(msgs.map((m) => [m.id, m]));
  const result: ChangeListOutput["items"] = [];
  for (const item of out.items) {
    const sources = [...new Set(item.source_msg_ids)].filter((id) => byId.has(id));
    if (sources.length === 0) continue; // never keep an item we can't trace to a message
    const authors = [...new Set(sources.map((id) => byId.get(id)!.authorId))];
    const type = item.confidence < LOW_CONFIDENCE ? "question" : item.type;
    result.push({ ...item, text: item.text.trim(), type, source_msg_ids: sources, author_ids: authors });
  }
  return result;
}

/** AI-2: only real contradictions between different people, about valid items, no duplicates. */
export function sanitizeConflicts(out: ConflictsOutput, items: ChangeListOutput["items"]) {
  const seen = new Set<string>();
  return out.conflicts.filter((c) => {
    const a = items[c.item_a];
    const b = items[c.item_b];
    if (!a || !b || c.item_a === c.item_b) return false;
    const authorsA = new Set(a.author_ids);
    if (b.author_ids.every((x) => authorsA.has(x))) return false; // same person changing their mind
    const key = [c.item_a, c.item_b].sort().join("-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Cleans AI-3 output: exactly one result per item we asked about (unknown ids dropped,
 * missing ones become needs_check). Without both images, visual/layout items can only be
 * needs_check (SRS FR-11: images are checked by a vision model or by a person).
 */
export function sanitizeDrift(
  out: DriftOutput | null,
  items: { id: string; type: string }[],
  imagesCompared: boolean,
): { itemId: string; verdict: DriftVerdict; note: string }[] {
  const byId = new Map<string, DriftOutput["results"][number]>();
  for (const r of out?.results ?? []) if (!byId.has(r.item_id)) byId.set(r.item_id, r);
  return items.map((it) => {
    const r = byId.get(it.id);
    let verdict: DriftVerdict = r?.verdict ?? "needs_check";
    const visual = it.type === "visual" || it.type === "layout";
    if (visual && !imagesCompared && verdict !== "needs_check") verdict = "needs_check";
    const note = r ? r.note.trim().slice(0, 300) : out ? "The AI didn't report on this one: check it by eye." : "AI check unavailable: check it by eye.";
    return { itemId: it.id, verdict, note };
  });
}
