import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Nexconn Platform Chat API signature (docs: platform-chat-api/prepare-to-use-api/auth):
 * Signature = sha1(AppSecret + Nonce + Timestamp), lowercase hex.
 * Webhooks use the same formula (platform-chat-api/webhook/overview).
 */
export function computeSignature(appSecret: string, nonce: string, timestamp: string): string {
  return createHash("sha1").update(appSecret + nonce + timestamp).digest("hex");
}

export interface SignedHeaders {
  "App-Key": string;
  Nonce: string;
  Timestamp: string;
  Signature: string;
}

export function signedHeaders(
  appKey: string,
  appSecret: string,
  now: number = Date.now(),
  nonce: string = String(randomInt(1, 2 ** 47)),
): SignedHeaders {
  const timestamp = String(now);
  return {
    "App-Key": appKey,
    Nonce: nonce.slice(0, 18),
    Timestamp: timestamp,
    Signature: computeSignature(appSecret, nonce.slice(0, 18), timestamp),
  };
}

/** Constant-time check of an incoming signature (used by the webhook in Round 3). */
export function verifySignature(
  appSecret: string,
  nonce: string,
  timestamp: string,
  signature: string,
): boolean {
  const expected = Buffer.from(computeSignature(appSecret, nonce, timestamp), "utf8");
  const given = Buffer.from(signature.toLowerCase(), "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
