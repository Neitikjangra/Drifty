import "server-only";
import { MissingEnvError } from "@/lib/env";
import { NexconnApiError } from "@/lib/nexconn/api";

/** JSON error with a friendly message. Never echoes secrets or message contents. */
export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Maps known failures to safe responses; logs only the error class and code. */
export function handleRouteError(route: string, err: unknown) {
  if (err instanceof MissingEnvError) {
    console.error(`[${route}] not configured: ${err.keys.join(", ")}`);
    return jsonError(503, "This feature isn't configured yet.");
  }
  if (err instanceof NexconnApiError) {
    console.error(`[${route}] ${err.message}`);
    return jsonError(502, "Chat service error. Please try again.");
  }
  console.error(`[${route}] unexpected error: ${err instanceof Error ? err.name : "unknown"}`);
  return jsonError(500, "Something went wrong. Please try again.");
}
