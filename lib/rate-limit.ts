import "server-only";
import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { jsonError } from "@/lib/http";

/**
 * Per-IP / per-user fixed-window limits (PRD section 7), counted in Postgres so every
 * serverless instance shares them. Keys are keyed hashes: no raw IPs or ids are stored.
 * If the limiter itself fails we let the request through (availability over strictness).
 */
export interface Rule {
  limit: number;
  windowSec: number;
  by: "ip" | "user";
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim() || "unknown";
}

function hashKey(raw: string): string {
  const secret = process.env.MAGIC_LINK_SIGNING_SECRET ?? "drifty-rate";
  return createHmac("sha256", secret).update(raw).digest("base64url").slice(0, 32);
}

/** Returns a 429 response when any rule is over its limit, otherwise null. */
export async function rateLimit(req: Request, bucket: string, rules: Rule[], userId?: string | null): Promise<Response | null> {
  if (process.env.RATE_LIMITS === "off") return null; // local load tests only
  const ip = clientIp(req);
  // Vercel always sets x-forwarded-for. Without it (a local server) every caller would share
  // one "unknown" IP, so per-IP rules only apply when the header is present.
  const hasIp = Boolean(req.headers.get("x-forwarded-for"));
  try {
    const db = supabaseAdmin();
    const results = await Promise.all(
      rules
        .filter((r) => (r.by === "ip" ? hasIp : Boolean(userId)))
        .map(async (r) => {
          const who = r.by === "ip" ? ip : userId!;
          const { data, error } = await db.rpc("rate_limit_hit", {
            p_key: `${bucket}:${r.by}:${hashKey(who)}:${r.windowSec}`,
            p_limit: r.limit,
            p_window_seconds: r.windowSec,
          });
          if (error) throw error;
          return { ok: data === true, r };
        }),
    );
    const over = results.find((x) => !x.ok);
    if (!over) return null;
    const mins = Math.max(1, Math.round(over.r.windowSec / 60));
    return jsonError(429, `Too many tries. Please wait ${mins === 1 ? "a minute" : `${mins} minutes`} and try again.`, undefined, {
      "Retry-After": String(over.r.windowSec),
    });
  } catch {
    console.warn(`[rate-limit] ${bucket} limiter unavailable`);
    return null;
  }
}

/** Shared presets so limits are consistent across routes. */
export const LIMITS = {
  join: [{ limit: 20, windowSec: 600, by: "ip" }] as Rule[],
  auth: [{ limit: 30, windowSec: 600, by: "ip" }] as Rule[],
  upload: [
    { limit: 60, windowSec: 3600, by: "user" },
    { limit: 120, windowSec: 3600, by: "ip" },
  ] as Rule[],
  ai: [
    { limit: 30, windowSec: 3600, by: "user" },
    { limit: 60, windowSec: 3600, by: "ip" },
  ] as Rule[],
  write: [
    { limit: 120, windowSec: 600, by: "user" },
    { limit: 300, windowSec: 600, by: "ip" },
  ] as Rule[],
  token: [
    { limit: 120, windowSec: 600, by: "user" },
    { limit: 300, windowSec: 600, by: "ip" },
  ] as Rule[],
  report: [{ limit: 30, windowSec: 600, by: "ip" }] as Rule[],
};
