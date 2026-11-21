import { describe, expect, it } from "vitest";
import { capMessages, LOW_CONFIDENCE, MAX_MESSAGES, sanitizeConflicts, sanitizeItems, type FeedbackMessage } from "@/lib/ai/guards";
import { changeListSchema, conflictsSchema } from "@/lib/ai/schemas";
import { isFreshTimestamp, parseWebhookMessage } from "@/lib/messages/parse";
import { readItemMeta } from "@/lib/feedback/cards";

const base = { userId: "u1", channelId: "cabc", channelType: 3, time: 1_800_000_000_000, messageId: "M-1" };

describe("webhook message parsing", () => {
  it("text, reply, voice, image, card", () => {
    expect(parseWebhookMessage({ ...base, messageType: "RC:TxtMsg", content: '{"content":"make the logo bigger"}' })).toMatchObject({
      kind: "text",
      text: "make the logo bigger",
      authorId: "u1",
      nexconnMsgId: "M-1",
    });
    expect(
      parseWebhookMessage({ ...base, messageType: "RC:ReferenceMsg", content: '{"content":"yes this","referMsg":{"content":"v1 card"}}' }),
    ).toMatchObject({ kind: "text", text: "yes this", replyToText: "v1 card" });
    expect(parseWebhookMessage({ ...base, messageType: "RC:HQVCMsg", content: '{"remoteUrl":"https://x/a.aac","duration":7}' })).toMatchObject({
      kind: "voice",
      voiceRemoteUrl: "https://x/a.aac",
      voiceDuration: 7,
    });
    expect(parseWebhookMessage({ ...base, messageType: "RC:ImgMsg", content: "{}" })?.kind).toBe("image");
    expect(parseWebhookMessage({ ...base, messageType: "drifty:deliverable", content: "{}" })?.kind).toBe("card");
  });

  it("ignores non-group channels, unknown types and broken JSON safely", () => {
    expect(parseWebhookMessage({ ...base, channelType: 1, messageType: "RC:TxtMsg", content: '{"content":"x"}' })).toBeNull();
    expect(parseWebhookMessage({ ...base, messageType: "RC:CmdMsg", content: "{}" })).toBeNull();
    expect(parseWebhookMessage({ ...base, messageType: "RC:TxtMsg", content: "not json" })).toMatchObject({ kind: "text", text: null });
  });

  it("rejects stale or missing webhook timestamps (replays)", () => {
    const now = 1_800_000_000_000;
    expect(isFreshTimestamp(String(now - 60_000), now)).toBe(true);
    expect(isFreshTimestamp(String(now - 10 * 60_000), now)).toBe(false);
    expect(isFreshTimestamp(null, now)).toBe(false);
    expect(isFreshTimestamp("abc", now)).toBe(false);
  });
});

const msgs: FeedbackMessage[] = [
  { id: "m1", authorId: "priya", authorName: "Priya", role: "approver", text: "Make the logo bigger", sentAt: "2026-11-21T10:00:00Z" },
  { id: "m2", authorId: "rahul", authorName: "Rahul", role: "reviewer", text: "[voice note] logo chhota karo, aur CTA 'Shop now' karo", sentAt: "2026-11-21T10:01:00Z" },
];

describe("AI guards", () => {
  it("drops items without a real source message and fixes authors from the sources", () => {
    const items = sanitizeItems(
      {
        items: [
          { text: "Make the logo bigger", type: "visual", source_msg_ids: ["m1"], author_ids: ["someone-else"], confidence: 0.9 },
          { text: "Invented change", type: "copy", source_msg_ids: ["nope"], author_ids: ["priya"], confidence: 0.9 },
        ],
      },
      msgs,
    );
    expect(items).toHaveLength(1);
    expect(items[0].author_ids).toEqual(["priya"]);
  });

  it("turns low-confidence items into questions instead of guessing", () => {
    const [item] = sanitizeItems(
      { items: [{ text: "Change the vibe?", type: "visual", source_msg_ids: ["m2"], author_ids: ["rahul"], confidence: LOW_CONFIDENCE - 0.1 }] },
      msgs,
    );
    expect(item.type).toBe("question");
  });

  it("keeps only contradictions between different people", () => {
    const items = sanitizeItems(
      {
        items: [
          { text: "Make the logo bigger", type: "visual", source_msg_ids: ["m1"], author_ids: ["priya"], confidence: 0.9 },
          { text: "Make the logo smaller", type: "visual", source_msg_ids: ["m2"], author_ids: ["rahul"], confidence: 0.9 },
          { text: "Actually make the logo bigger", type: "visual", source_msg_ids: ["m1"], author_ids: ["priya"], confidence: 0.9 },
        ],
      },
      msgs,
    );
    const out = sanitizeConflicts(
      {
        conflicts: [
          { item_a: 0, item_b: 1, summary: "Logo size" },
          { item_a: 1, item_b: 0, summary: "duplicate" },
          { item_a: 0, item_b: 2, summary: "same person" },
          { item_a: 0, item_b: 9, summary: "bad index" },
        ],
      },
      items,
    );
    expect(out).toEqual([{ item_a: 0, item_b: 1, summary: "Logo size" }]);
  });

  it("caps input at the last 200 messages", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ sentAt: new Date(1_800_000_000_000 + i * 1000).toISOString(), i }));
    const capped = capMessages(many);
    expect(capped).toHaveLength(MAX_MESSAGES);
    expect(capped[0].i).toBe(50);
  });

  it("schemas reject malformed AI output", () => {
    expect(changeListSchema.safeParse({ items: [{ text: "x", type: "colour", source_msg_ids: ["m1"], author_ids: ["a"], confidence: 1 }] }).success).toBe(false);
    expect(changeListSchema.safeParse({ items: [{ text: "x", type: "copy", source_msg_ids: [], author_ids: ["a"], confidence: 1 }] }).success).toBe(false);
    expect(conflictsSchema.safeParse({ conflicts: [{ item_a: -1, item_b: 0, summary: "x" }] }).success).toBe(false);
  });

  it("reads per-item card metadata", () => {
    expect(readItemMeta({ i0: '{"s":"confirmed","t":"Edited"}' }, 0)).toEqual({ s: "confirmed", t: "Edited" });
    expect(readItemMeta({ i1: "garbage" }, 1)).toBeNull();
    expect(readItemMeta({}, 2)).toBeNull();
  });
});
