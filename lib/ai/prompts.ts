import type { ChangeListOutput } from "./schemas";
import type { FeedbackMessage } from "./guards";

/** AI-1 system prompt (PRD section 6, verbatim intent). */
export const AI1_SYSTEM =
  "You turn client feedback on a creative deliverable into discrete, actionable change requests. " +
  "Use only what the messages say. One item per change. If a message is unclear, output it as type 'question'. " +
  "Messages may be in English, Hindi (Devanagari), or Hinglish (Hindi in Latin letters, e.g. 'logo thoda bada karo' = " +
  "'make the logo a bit bigger', 'button pe Book now likho' = 'write Book now on the button'); voice notes arrive as transcripts " +
  "marked [voice note]. Understand all of them, and split one message into several items when it asks for several changes. " +
  "Never invent changes. Ignore greetings, thanks and chit-chat (e.g. 'thanks', 'dhanyavaad', 'badhiya'). Every item must list the exact message ids it comes from " +
  "and the author ids of those messages. Write each item as a short instruction to the designer, in English, " +
  "even if the client wrote in Hindi or Hinglish. If different people ask for opposite things (e.g. a bigger vs a smaller logo), " +
  "output each person's request as its own item with only that person's message: never merge them into one item or a question. " +
  "Contradictions are resolved in a separate step.";

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
  "Do not report items that are compatible, merely different, or from the same person. If there are none, return an empty list. " +
  "Requests may have been written in English, Hindi or Hinglish originally; judge their meaning, and write the summary in English.";

export function ai2Prompt(items: ChangeListOutput["items"], names: Map<string, string>): string {
  return [
    "Change requests (index: text — authors):",
    ...items.map((it, i) => `${i}: ${it.text} — ${it.author_ids.map((a) => names.get(a) ?? a).join(", ")} (author ids: ${it.author_ids.join(", ")})`),
  ].join("\n");
}

/** AI-3 system prompt (PRD section 6 + SRS FR-11). */
export const AI3_SYSTEM =
  "You check whether a new version of a creative deliverable carries out the change requests the agency confirmed. " +
  "For each request give one verdict: 'done' (clearly carried out), 'missing' (not carried out), 'reversed' (the new " +
  "version goes against it, or undoes something the old version already had), or 'needs_check' (you can't tell for sure). " +
  "Compare copy text directly, word for word. For visual or layout requests use 'needs_check' unless the change is clearly " +
  "visible when you compare the two images. If images aren't provided, visual and layout requests are 'needs_check'. " +
  "Never guess 'done'. Return exactly one result per request, using the ids given.";

export function ai3Prompt(input: {
  title: string;
  fromVersion: number;
  toVersion: number;
  oldCopy: string;
  newCopy: string;
  items: { id: string; text: string; type: string }[];
  images: "both" | "none";
}): string {
  return [
    `Deliverable: ${input.title}. Old version: v${input.fromVersion}. New version: v${input.toVersion}.`,
    "",
    `Old copy (v${input.fromVersion}): ${input.oldCopy || "(none)"}`,
    `New copy (v${input.toVersion}): ${input.newCopy || "(none)"}`,
    "",
    "Confirmed change requests, one JSON object per line:",
    ...input.items.map((i) => JSON.stringify({ id: i.id, type: i.type, request: i.text })),
    "",
    input.images === "both"
      ? `Two images follow: first the old version (v${input.fromVersion}), then the new version (v${input.toVersion}).`
      : "No images are available to compare.",
  ].join("\n");
}

export const AI4_SYSTEM =
  "You are a pre-flight check for a creative agency. Before a draft goes to the client, predict the feedback THIS client " +
  "is likely to give, so the team can fix it first. Use only three sources: the brief, the brand rules, and the client's " +
  "past change requests (their taste). Every prediction must be tied to one of them; say which in 'basis' and point at it " +
  "in 'evidence'. A past request counts when the new draft repeats the same kind of problem (e.g. they asked for a bigger " +
  "logo before and the logo is small again). Look at the image for visual and layout points; compare copy word for word. " +
  "Don't list something the draft already gets right. Don't give generic design, grammar or style advice the sources don't " +
  "support. Past requests may be in Hinglish; write predictions in plain English. 'high' = clearly breaks a rule or repeats " +
  "a past complaint; otherwise 'medium'. At most 5 predictions, most likely first; an empty list is a good answer.";

export function ai4Prompt(input: {
  title: string;
  version: number;
  copy: string;
  brief: string;
  brandRules: string;
  memory: { text: string; type: string; where: string }[];
  image: boolean;
}): string {
  return [
    `Deliverable: ${input.title}. This draft would go to the client as v${input.version}.`,
    "",
    `Brief: ${input.brief || "(none)"}`,
    "",
    `Brand rules: ${input.brandRules || "(none)"}`,
    "",
    input.memory.length ? "This client's past change requests, newest first, one JSON object per line:" : "Past change requests: (none yet)",
    ...input.memory.map((m) => JSON.stringify({ request: m.text, type: m.type, on: m.where })),
    "",
    `Draft copy: ${input.copy || "(none)"}`,
    input.image ? "The draft image follows." : "No image is available; judge copy only and skip visual points.",
  ].join("\n");
}
