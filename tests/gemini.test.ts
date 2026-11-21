import { describe, expect, it } from "vitest";
import { isOverload, isQuota } from "@/lib/ai/gemini";

describe("Gemini error handling", () => {
  it("treats 429/5xx/timeouts as busy (try the fallback), 4xx as real errors", () => {
    expect(isOverload({ status: 503 })).toBe(true);
    expect(isOverload({ status: 429 })).toBe(true);
    expect(isOverload({ status: 404 })).toBe(false);
    expect(isOverload({ name: "AbortError" })).toBe(true);
  });
  it("recognises a used-up quota", () => {
    expect(isQuota({ status: 429, message: '{"status":"RESOURCE_EXHAUSTED"}' })).toBe(true);
    expect(isQuota({ status: 503, message: "UNAVAILABLE" })).toBe(false);
  });
});
