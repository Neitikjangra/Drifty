import "server-only";
import { randomUUID } from "node:crypto";

/**
 * Minimal Sentry reporter over Sentry's HTTP envelope API (no SDK, no build plugin), on only
 * when SENTRY_DSN is set. Privacy (CLAUDE.md, PRD section 7): we send the error class, stack
 * frames and a route tag. Never message text (it could quote client content), request bodies,
 * cookies or user ids.
 */

interface Dsn {
  url: string;
  key: string;
}
let parsed: Dsn | null | undefined;
function dsn(): Dsn | null {
  if (parsed !== undefined) return parsed;
  const raw = process.env.SENTRY_DSN?.trim().replace(/^"(.*)"$/, "$1");
  try {
    if (!raw) throw new Error("no dsn");
    const u = new URL(raw);
    const projectId = u.pathname.replace(/^\/+/, "");
    if (!u.username || !projectId) throw new Error("bad dsn");
    parsed = { url: `${u.protocol}//${u.host}/api/${projectId}/envelope/`, key: u.username };
  } catch {
    parsed = null;
  }
  return parsed;
}

export const sentryEnabled = () => dsn() !== null;

/** Stack frames only: the first line of `stack` repeats the message, so it's dropped. */
function frames(err: unknown) {
  const stack = err instanceof Error && err.stack ? err.stack.split("\n").slice(1, 30) : [];
  return stack
    .map((l) => /at (?:(.+?) )?\(?(.+?):(\d+):(\d+)\)?$/.exec(l.trim()))
    .filter(Boolean)
    .reverse()
    .map((m) => ({ function: m![1] ?? "?", filename: m![2].replace(/^.*?(\/(app|lib|components|\.next)\/)/, "$1"), lineno: Number(m![3]), colno: Number(m![4]) }));
}

/** Fire-and-forget; never throws, never delays the response by more than 2 s. */
export async function captureError(err: unknown, tags: Record<string, string>) {
  const d = dsn();
  if (!d) return;
  const id = randomUUID().replace(/-/g, "");
  const type = err instanceof Error ? err.name : typeof err;
  const event = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
    tags,
    exception: { values: [{ type, value: "(message withheld for privacy)", stacktrace: { frames: frames(err) } }] },
  };
  const body = `${JSON.stringify({ event_id: id, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
  try {
    await fetch(d.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${d.key}, sentry_client=drifty/1.0`,
      },
      body,
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Reporting must never break the app.
  }
}
