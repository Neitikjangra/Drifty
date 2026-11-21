import type { ChangeListOutput } from "./schemas";
import type { FeedbackMessage } from "./guards";

/** AI-1 system prompt (PRD section 6, verbatim intent). */
export const AI1_SYSTEM =
  "You turn client feedback on a creative deliverable into discrete, actionable change requests. " +
  "Use only what the messages say. One item per change. If a message is unclear, output it as type 'question'. " +
  "Never invent changes. Ignore greetings, thanks and chit-chat. Every item must list the exact message ids it comes from " +
  "and the author ids of those messages. Write each item as a short instruction to the designer, in English, " +
  "even if the client wrote in Hindi or Hinglish.";

export function ai1Prompt(input: { title: string; version: number; copy: string; messages: FeedbackMessage[] }): string {
  const lines = input.messages.map((m) =>
    JSON.stringify({ id: m.id, author_id: m.authorId, author: m.authorName, role: m.role, reply_to: m.replyTo ?? null, text: m.text }),
  );
  return [
    `Deliverable: ${input.title} (version ${input.version})`,
    `Current copy/caption: ${input.copy || "(none)"}`,
    "",
    "Client room messages since this version was posted (oldest first), one JSON object per line:",
    ...lines,
  ].join("\n");
}

/** AI-2 system prompt (PRD section 6). */
export const AI2_SYSTEM =
  "You find real contradictions in client feedback. Two change requests conflict only if they cannot both be done " +
  "(e.g. 'make the logo bigger' vs 'make the logo smaller', or two different CTAs) AND they come from different people. " +
  "Do not report items that are compatible, merely different, or from the same person. If there are none, return an empty list.";

export function ai2Prompt(items: ChangeListOutput["items"], names: Map<string, string>): string {
  return [
    "Change requests (index: text — authors):",
    ...items.map((it, i) => `${i}: ${it.text} — ${it.author_ids.map((a) => names.get(a) ?? a).join(", ")} (author ids: ${it.author_ids.join(", ")})`),
  ].join("\n");
}
