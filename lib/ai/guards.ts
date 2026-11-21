import type { ChangeListOutput, ConflictsOutput } from "./schemas";

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
