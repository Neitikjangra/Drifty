import { describe, expect, it } from "vitest";
import { ai4Prompt } from "@/lib/ai/prompts";
import { preflightSchema } from "@/lib/ai/schemas";
import { hasContext, sanitizePredictions, tasteMemory, type PastRequest } from "@/lib/preflight/rules";

const req = (text: string, status: string, createdAt: string, type = "visual"): PastRequest => ({ text, type, status, createdAt, deliverableTitle: "Diwali post", version: 1 });

describe("pre-flight check", () => {
  it("taste memory: accepted requests only, newest first, no duplicates or questions", () => {
    const m = tasteMemory([
      req("Make the logo bigger", "confirmed", "2026-11-01T00:00:00Z"),
      req("make the LOGO bigger!", "done", "2026-11-05T00:00:00Z"),
      req("Use a red background", "rejected", "2026-11-06T00:00:00Z"),
      req("Maybe try blue?", "suggested", "2026-11-06T00:00:00Z"),
      req("Is the offer 20% or 25%?", "confirmed", "2026-11-07T00:00:00Z", "question"),
      req("CTA should say Order now", "missing", "2026-11-04T00:00:00Z", "copy"),
    ]);
    expect(m.map((x) => x.text)).toEqual(["make the LOGO bigger!", "CTA should say Order now"]);
    expect(m[0].where).toBe("Diwali post v1");
  });
  it("doesn't call the AI with nothing client-specific", () => {
    expect(hasContext({ brief: " ", brandRules: "", memory: [] })).toBe(false);
    expect(hasContext({ brief: "", brandRules: "Logo top-left", memory: [] })).toBe(true);
  });
  it("keeps only predictions backed by a source we sent; high first; capped", () => {
    const out = preflightSchema.parse({
      predictions: [
        { feedback: "CTA unclear", area: "copy", basis: "brief", evidence: "Brief asks for a clear CTA", likelihood: "medium" },
        { feedback: "Logo too small", area: "visual", basis: "past_feedback", evidence: "Asked for a bigger logo on Diwali post v1", likelihood: "high" },
        { feedback: "Off-brand green", area: "brand", basis: "brand_rules", evidence: "No rules were given", likelihood: "high" },
        { feedback: "logo too small", area: "visual", basis: "past_feedback", evidence: "dup", likelihood: "medium" },
      ],
    });
    const kept = sanitizePredictions(out, { brief: "Clear CTA", brandRules: "", memory: [{ text: "Bigger logo", type: "visual", where: "Diwali post v1" }] });
    expect(kept.map((p) => p.feedback)).toEqual(["Logo too small", "CTA unclear"]);
  });
  it("prompt carries the brief, rules, memory and copy", () => {
    const p = ai4Prompt({ title: "Diwali post", version: 2, copy: "Shop now", brief: "Clear CTA", brandRules: "Logo top-left", memory: [{ text: "Bigger logo", type: "visual", where: "Diwali post v1" }], image: true });
    expect(p).toContain("Brief: Clear CTA");
    expect(p).toContain("Brand rules: Logo top-left");
    expect(p).toContain('"request":"Bigger logo"');
    expect(p).toContain("Draft copy: Shop now");
    expect(p).toContain("draft image follows");
  });
});
