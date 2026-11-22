import { timingSafeEqual } from "node:crypto";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { runDaily } from "@/lib/round6/daily";

export const maxDuration = 300;

/**
 * GET /api/cron/daily: Vercel Cron (vercel.json, 03:30 UTC = 09:00 IST). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else is refused. Runs nudges + digests.
 * `?project=<id>` limits the run to one project (tests, or re-running one room by hand).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim().replace(/^"(.*)"$/, "$1");
  if (!secret) return jsonError(503, "Cron isn't configured.");
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return jsonError(401, "Unauthorized.");
  try {
    const project = new URL(req.url).searchParams.get("project");
    if (project && !/^[0-9a-f-]{36}$/.test(project)) return jsonError(400, "Bad project id.");
    return ok(await runDaily(new Date(), project ?? undefined));
  } catch (err) {
    return handleRouteError("cron/daily", err);
  }
}
