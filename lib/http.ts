import "server-only";
import type { z } from "zod";
import { MissingEnvError } from "@/lib/env";
import { DbError } from "@/lib/db/repo";
import { NexconnApiError } from "@/lib/nexconn/api";

/** Parses a JSON body against a schema; null if missing or invalid. */
export async function readBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | null> {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const ok = (data: Record<string, unknown> = {}, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

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
  if (err instanceof DbError) {
    console.error(`[${route}] ${err.message}`);
    return jsonError(500, "We couldn't save that. Please try again.");
  }
  if (err instanceof NexconnApiError) {
    console.error(`[${route}] ${err.message}`);
    return jsonError(502, "Chat service error. Please try again.");
  }
  console.error(`[${route}] unexpected error: ${err instanceof Error ? err.name : "unknown"}`);
  return jsonError(500, "Something went wrong. Please try again.");
}
