/**
 * Next.js instrumentation: page/render errors that never reach a route's try/catch go to
 * Sentry too (no-op without SENTRY_DSN). Only the route path is tagged, never the URL query.
 */
export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routePath: string; routeType: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureError } = await import("@/lib/observability/sentry");
  await captureError(err, { route: context.routePath, type: context.routeType, method: request.method });
}
