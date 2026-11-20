import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeSignature, signedHeaders, verifySignature } from "@/lib/nexconn/sign";

describe("Nexconn signature", () => {
  it("is sha1(secret + nonce + timestamp) in lowercase hex", () => {
    const expected = createHash("sha1").update("sec" + "14314" + "1408710653491").digest("hex");
    expect(computeSignature("sec", "14314", "1408710653491")).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{40}$/);
  });

  it("builds the four signed headers", () => {
    const h = signedHeaders("key", "sec", 1700000000000, "abc");
    expect(h["App-Key"]).toBe("key");
    expect(h.Nonce).toBe("abc");
    expect(h.Timestamp).toBe("1700000000000");
    expect(h.Signature).toBe(computeSignature("sec", "abc", "1700000000000"));
  });

  it("caps the nonce at 18 characters", () => {
    const h = signedHeaders("key", "sec", 1, "1234567890123456789012");
    expect(h.Nonce).toHaveLength(18);
    expect(h.Signature).toBe(computeSignature("sec", h.Nonce, "1"));
  });

  it("verifies valid signatures and rejects tampered ones", () => {
    const sig = computeSignature("sec", "n", "1");
    expect(verifySignature("sec", "n", "1", sig)).toBe(true);
    expect(verifySignature("sec", "n", "1", sig.toUpperCase())).toBe(true);
    expect(verifySignature("sec", "n", "2", sig)).toBe(false);
    expect(verifySignature("other", "n", "1", sig)).toBe(false);
    expect(verifySignature("sec", "n", "1", "short")).toBe(false);
  });
});
