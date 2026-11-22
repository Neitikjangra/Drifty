import { z } from "zod";
import { readBody } from "@/lib/http";
import { captureError } from "@/lib/observability/sentry";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

const body = z.object({
  name: z.string().max(80),
  digest: z.string().max(80).nullable(),
  path: z.string().max(300),
  frames: z.string().max(4000),
});

/** POST /api/client-error: browser crash reports → Sentry (class + frames only). Always 204. */
export async function POST(req: Request) {
  const limited = await rateLimit(req, "client-error", LIMITS.report);
  if (limited) return new Response(null, { status: 204 });
  const input = await readBody(req, body);
  if (input) {
    const err = new Error("client");
    err.name = input.name.replace(/[^\w.$-]/g, "").slice(0, 80) || "Error";
    err.stack = `${err.name}\n${input.frames}`;
    // Paths can contain ids; keep only the route shape.
    const route = input.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "[id]").replace(/\/join\/[^/]+/, "/join/[token]");
    await captureError(err, { route, side: "browser", ...(input.digest ? { digest: input.digest } : {}) });
  }
  return new Response(null, { status: 204 });
}
