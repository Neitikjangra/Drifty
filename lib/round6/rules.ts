/**
 * Pure rules for the Round 6 "Should" items (unit-tested):
 * FR-16 vague approvals, FR-17 nudge timing, FR-15 scope thresholds, FR-18 digest text.
 */

// ------------------------------------------------------------------ FR-16 approval drift

const VAGUE = [
  "ok", "okay", "okk", "okkk", "k", "kk", "done", "fine", "good", "great", "perfect", "nice", "super", "awesome",
  "looks good", "looks great", "looks fine", "all good", "lgtm", "approved", "go ahead", "go for it", "yes", "yep", "yup",
  "sounds good", "love it", "chalega", "chalo", "theek hai", "thik hai", "theek h", "thik h", "badhiya", "badiya", "sahi hai",
  "haan", "ha", "haa", "ji", "ji haan", "done hai", "ok hai", "okay hai", "ho gaya", "mast",
];
const EMOJI_OK = /^[\s👍👌✅🙌💯🔥❤️👏🏻🏼🏽🏾🏿\u{fe0f}]+$/u;
/** Words that make it a change request or a doubt, not an approval. */
const NOT_APPROVAL = /\?|\b(but|change|make|not|no|nahi|nhi|mat|lekin|par|wait|hold|instead|except|only|bigger|smaller|remove|add)\b/i;

/**
 * A short "ok" / 👍 / "theek hai" that sounds like approval but wasn't given on the card.
 * Drifty only asks; the approver's own Yes on the check card is what approves.
 */
export function isVagueApproval(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t || t.length > 40) return false;
  if (EMOJI_OK.test(t)) return true;
  if (NOT_APPROVAL.test(t)) return false;
  const norm = t
    .toLowerCase()
    .replace(/[\p{Extended_Pictographic}\u{fe0f}\u{1f3fb}-\u{1f3ff}]/gu, " ")
    .replace(/[.!,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(sir|ma'?am|team|bro|ji)$/i, "")
    .trim();
  return VAGUE.includes(norm);
}

// ------------------------------------------------------------------ dates (India time)

const IST_MS = 5.5 * 60 * 60 * 1000;
export const istDate = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export function prettyDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

// ------------------------------------------------------------------ FR-17 nudges

/** Nudge when an unapproved card is due today or tomorrow (the daily run is ~24 h ahead). */
export function nudgeWhen(dueDate: string | null, status: string, now: Date): "today" | "tomorrow" | null {
  if (!dueDate || status !== "in_review") return null;
  const today = istDate(now);
  if (dueDate === today) return "today";
  if (dueDate === addDays(today, 1)) return "tomorrow";
  return null;
}

export function nudgeText(opts: { title: string; version: number; dueDate: string; when: "today" | "tomorrow"; approver: string | null }): string {
  const who = opts.approver ? `${opts.approver}, could you` : "Could you";
  return `Reminder: ${opts.title} v${opts.version} is due ${opts.when} (${prettyDay(opts.dueDate)}). ${who} review it and tap Approve or Request changes on the card?`;
}

// ------------------------------------------------------------------ FR-15 scope drift

/** Revision rounds = versions the client saw after the first. */
export function scopeState(roundsUsed: number, included: number): "at_limit" | "over" | null {
  if (roundsUsed > included) return "over";
  if (roundsUsed === included && included > 0) return "at_limit";
  return null;
}

/** Template note (also the fallback when the AI can't draft one). Polite, factual, editable. */
export function scopeNoteTemplate(opts: { title: string; roundsUsed: number; included: number; state: "at_limit" | "over" }): string {
  return opts.state === "at_limit"
    ? `Quick note on ${opts.title}: this version uses the last of the ${opts.included} revision rounds in our agreement. ` +
        `If you'd like more changes after this, we're happy to help. We'll share what an extra round includes before starting.`
    : `Quick note on ${opts.title}: we're now on revision round ${opts.roundsUsed}, beyond the ${opts.included} included in our agreement. ` +
        `We're glad to keep going. Shall we confirm the extra rounds before the next version?`;
}

// ------------------------------------------------------------------ FR-18 daily digest

export interface DigestInput {
  clientName: string;
  approvals: { title: string; version: number; by: string }[];
  newVersions: { title: string; version: number; held: boolean }[];
  changeLists: number;
  clientMessages: number;
  deliverables: { title: string; version: number; status: string; dueDate: string | null; openConflicts: number }[];
}

/** The digest text, or null when there's nothing worth a message (no news, nothing waiting). */
export function digestText(input: DigestInput): string | null {
  const moved: string[] = [];
  for (const a of input.approvals) moved.push(`✅ ${a.title} v${a.version} approved by ${a.by}`);
  for (const v of input.newVersions) moved.push(`🆕 ${v.title} v${v.version} ${v.held ? "uploaded (held for the drift check)" : "sent to the client"}`);
  if (input.changeLists) moved.push(`📝 ${input.changeLists} change list${input.changeLists > 1 ? "s" : ""} summarised`);
  if (input.clientMessages) moved.push(`💬 ${input.clientMessages} new client message${input.clientMessages > 1 ? "s" : ""}`);

  const due = (d: { dueDate: string | null }) => (d.dueDate ? `, due ${prettyDay(d.dueDate)}` : "");
  const blocked: string[] = [];
  const client: string[] = [];
  const team: string[] = [];
  for (const d of input.deliverables) {
    const name = `${d.title} v${d.version}`;
    if (d.status === "draft") blocked.push(`${name}: held for the drift check, needs your decision`);
    if (d.openConflicts) blocked.push(`${name}: the approver hasn't settled ${d.openConflicts} conflict${d.openConflicts > 1 ? "s" : ""}`);
    if (d.status === "in_review" || d.openConflicts) client.push(`${name}${due(d)}`);
    else if (d.status === "changes_requested" || d.status === "draft") team.push(`${name}${due(d)}`);
  }
  if (!moved.length && !client.length && !team.length) return null;
  const lines = [`Daily digest · ${input.clientName}`];
  lines.push("", "Moved in the last 24 h:", ...(moved.length ? moved.map((m) => `• ${m}`) : ["• Nothing new"]));
  if (blocked.length) lines.push("", "Blocked:", ...blocked.map((b) => `• ${b}`));
  if (client.length) lines.push("", "Waiting on the client:", ...client.map((c) => `• ${c}`));
  if (team.length) lines.push("", "Waiting on the team:", ...team.map((t) => `• ${t}`));
  return lines.join("\n").slice(0, 3500);
}
