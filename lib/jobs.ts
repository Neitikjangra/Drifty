import "server-only";
import { supabaseAdmin } from "@/lib/db/supabase-server";

/**
 * Background work with retries (PRD section 7: failed AI/webhook jobs retry 3 times through
 * `jobs`). Each run is recorded with its outcome and attempts; payloads hold ids only and
 * errors are stored as their class name, never message text.
 */
export async function runJob(kind: string, payload: Record<string, string | number>, fn: () => Promise<unknown>, attempts = 3): Promise<boolean> {
  const db = supabaseAdmin();
  const started = Date.now();
  const { data } = await db.from("jobs").insert({ kind, payload, status: "running", attempts: 0 }).select("id").single();
  const id = (data as { id: string } | null)?.id;
  let lastError = "";
  for (let n = 1; n <= attempts; n++) {
    try {
      await fn();
      if (id) await db.from("jobs").update({ status: "done", attempts: n, last_error: null, updated_at: new Date().toISOString() }).eq("id", id);
      console.info(`[job] ${kind} done attempts=${n} ms=${Date.now() - started}`);
      return true;
    } catch (err) {
      lastError = err instanceof Error ? err.name : "error";
      if (n < attempts) await new Promise((r) => setTimeout(r, 1500 * n)); // 1.5 s, 3 s
    }
  }
  if (id) await db.from("jobs").update({ status: "failed", attempts, last_error: lastError, updated_at: new Date().toISOString() }).eq("id", id);
  console.warn(`[job] ${kind} failed attempts=${attempts} error=${lastError} ms=${Date.now() - started}`);
  return false;
}
