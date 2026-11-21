import { z } from "zod";

/** AI-1 output (PRD section 6). */
export const changeListSchema = z.object({
  items: z
    .array(
      z.object({
        text: z.string().min(1).max(500),
        type: z.enum(["copy", "visual", "layout", "other", "question"]),
        source_msg_ids: z.array(z.string()).min(1),
        author_ids: z.array(z.string()).min(1),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(40),
});
export type ChangeListOutput = z.infer<typeof changeListSchema>;

/** AI-2 output (PRD section 6): indexes refer to the AI-1 items list. */
export const conflictsSchema = z.object({
  conflicts: z
    .array(
      z.object({
        item_a: z.number().int().min(0),
        item_b: z.number().int().min(0),
        summary: z.string().min(1).max(300),
      }),
    )
    .max(10),
});
export type ConflictsOutput = z.infer<typeof conflictsSchema>;

/** JSON Schemas sent to Gemini (structured output). Kept in sync with the Zod schemas above. */
export const changeListJsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "One concrete, actionable change in plain words." },
          type: { type: "string", enum: ["copy", "visual", "layout", "other", "question"] },
          source_msg_ids: { type: "array", items: { type: "string" }, description: "ids of the messages this comes from" },
          author_ids: { type: "array", items: { type: "string" }, description: "author ids of those messages" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["text", "type", "source_msg_ids", "author_ids", "confidence"],
      },
    },
  },
  required: ["items"],
} as const;

export const conflictsJsonSchema = {
  type: "object",
  properties: {
    conflicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item_a: { type: "integer", description: "index of the first item" },
          item_b: { type: "integer", description: "index of the contradicting item" },
          summary: { type: "string", description: "one sentence: what the two people disagree about" },
        },
        required: ["item_a", "item_b", "summary"],
      },
    },
  },
  required: ["conflicts"],
} as const;
