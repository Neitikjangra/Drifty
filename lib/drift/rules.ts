/** Pure Round 4 rules for the version drift check (FR-11). Unit-tested. */

export const CHECKED_STATUSES = ["confirmed", "done", "missing", "reversed", "needs_check"] as const;
const STILL_OPEN = new Set(["missing", "reversed", "needs_check"]);

export interface ItemForCheck {
  id: string;
  version_id: string;
  text: string;
  type: string;
  status: string;
  created_at: string;
}

/**
 * Which change items vN+1 is checked against: everything confirmed on the last version the
 * client saw (re-checked each time, so a later version can't quietly undo it), plus items an
 * earlier check left missing/reversed/unchecked. Questions are never "done" by a design
 * change, so they're left out. Same request twice (e.g. summarised twice) counts once.
 */
export function itemsToCheck(items: ItemForCheck[], lastSentVersionId: string): ItemForCheck[] {
  const picked = items.filter(
    (i) =>
      i.type !== "question" &&
      ((i.version_id === lastSentVersionId && (CHECKED_STATUSES as readonly string[]).includes(i.status)) || STILL_OPEN.has(i.status)),
  );
  const byText = new Map<string, ItemForCheck>();
  for (const i of [...picked].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    byText.set(i.text.trim().toLowerCase().replace(/\s+/g, " "), i); // newest wins
  }
  return [...byText.values()];
}

export function driftCounts(results: { verdict: string }[]) {
  const c = { done: 0, missing: 0, reversed: 0, needs_check: 0 };
  for (const r of results) if (r.verdict in c) c[r.verdict as keyof typeof c]++;
  return c;
}

/** "Send v2 to client" when everything is done, otherwise the AM must knowingly override. */
export function sendLabel(results: { verdict: string }[], toVersion: number): string {
  return results.every((r) => r.verdict === "done") ? `Send v${toVersion} to client` : "Send to client anyway";
}

/** The note the creative gets on "Back to creative". */
export function backToCreativeText(title: string, toVersion: number, results: { text: string; verdict: string; note: string }[]): string {
  const open = results.filter((r) => r.verdict !== "done");
  const label: Record<string, string> = { missing: "missing", reversed: "reversed", needs_check: "check" };
  return [
    `Back to creative: ${title} v${toVersion} isn't ready for the client yet.`,
    ...(open.length
      ? open.map((r, i) => `${i + 1}. [${label[r.verdict] ?? r.verdict}] ${r.text}${r.note ? ` (${r.note})` : ""}`)
      : ["The AM sent it back for another pass."]),
    `Upload v${toVersion + 1} from the project page when it's ready.`,
  ].join("\n");
}
