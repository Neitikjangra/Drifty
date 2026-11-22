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

/** AI-3 output (PRD section 6): one verdict per confirmed item, by the item ids we sent. */
export const DRIFT_VERDICTS = ["done", "missing", "reversed", "needs_check"] as const;
export type DriftVerdict = (typeof DRIFT_VERDICTS)[number];
export const driftSchema = z.object({
  results: z
    .array(
      z.object({
        item_id: z.string().min(1),
        verdict: z.enum(DRIFT_VERDICTS),
        note: z.string().max(300),
      }),
    )
    .max(60),
});
export type DriftOutput = z.infer<typeof driftSchema>;

export const driftJsonSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "the id of the change request, exactly as given" },
          verdict: { type: "string", enum: [...DRIFT_VERDICTS] },
          note: { type: "string", description: "one short sentence: what you saw in the new version" },
        },
        required: ["item_id", "verdict", "note"],
      },
    },
  },
  required: ["results"],
} as const;

/** AI-4 pre-flight output: feedback this client is likely to give, each tied to its evidence. */
export const PREFLIGHT_AREAS = ["copy", "visual", "layout", "brand", "other"] as const;
export const PREFLIGHT_BASES = ["brief", "brand_rules", "past_feedback"] as const;
export const preflightSchema = z.object({
  predictions: z
    .array(
      z.object({
        feedback: z.string().min(1).max(300),
        area: z.enum(PREFLIGHT_AREAS),
        basis: z.enum(PREFLIGHT_BASES),
        evidence: z.string().max(400),
        likelihood: z.enum(["high", "medium"]),
      }),
    )
    .max(10),
});
export type PreflightOutput = z.infer<typeof preflightSchema>;

export const preflightJsonSchema = {
  type: "object",
  properties: {
    predictions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          feedback: { type: "string", description: "What the client is likely to say, short, e.g. 'Logo too small on phone'." },
          area: { type: "string", enum: [...PREFLIGHT_AREAS] },
          basis: { type: "string", enum: [...PREFLIGHT_BASES], description: "what this prediction comes from" },
          evidence: { type: "string", description: "one short sentence pointing at the brief line, brand rule or past request" },
          likelihood: { type: "string", enum: ["high", "medium"] },
        },
        required: ["feedback", "area", "basis", "evidence", "likelihood"],
      },
    },
  },
  required: ["predictions"],
} as const;
