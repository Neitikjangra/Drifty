"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/client-report";

/** Last-resort error screen (the root layout itself failed). Plain HTML: no app styles load. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 16 }}>
          <h1 style={{ fontSize: 20 }}>Drifty hit a problem</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>Please try again. Your work is saved.</p>
          <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#0f172a", color: "#fff" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
