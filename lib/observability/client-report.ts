/** Browser side: send a crash's class and stack frames (never its message) to /api/client-error. */
export function reportClientError(error: Error & { digest?: string }) {
  try {
    const frames = (error.stack ?? "").split("\n").slice(1, 20).join("\n").slice(0, 4000);
    const body = JSON.stringify({ name: error.name || "Error", digest: error.digest ?? null, path: window.location.pathname, frames });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/client-error", new Blob([body], { type: "application/json" }));
    else void fetch("/api/client-error", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    // never let reporting cause another error
  }
}
