import type { PreflightOutput } from "@/lib/ai/schemas";

/**
 * Pre-flight check rules (pure, unit-tested): what the AI gets as the client's "taste memory",
 * and what we accept back from it.
 */

/** Change requests the agency accepted (not suggestions it threw away). */
const ACCEPTED = new Set(["confirmed", "done", "missing", "reversed", "needs_check"]);
export const MEMORY_LIMIT = 40;
export const MAX_PREDICTIONS = 5;

export interface PastRequest {
  text: string;
  type: string;
  status: string;
  deliverableTitle: string;
  version: number;
  createdAt: string;
}

export interface MemoryLine {
  text: string;
  type: string;
  where: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Newest first, accepted only, near-duplicates once, questions left out, capped. */
export function tasteMemory(items: PastRequest[]): MemoryLine[] {
  const seen = new Set<string>();
  const out: MemoryLine[] = [];
  for (const i of [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (!ACCEPTED.has(i.status) || i.type === "question") continue;
    const key = norm(i.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ text: i.text.slice(0, 200), type: i.type, where: `${i.deliverableTitle.slice(0, 60)} v${i.version}` });
    if (out.length >= MEMORY_LIMIT) break;
  }
  return out;
}

/** True when there's anything client-specific to check against (otherwise we don't call the AI). */
export function hasContext(c: { brief: string; brandRules: string; memory: MemoryLine[] }): boolean {
  return Boolean(c.brief.trim() || c.brandRules.trim() || c.memory.length);
}

export type Prediction = PreflightOutput["predictions"][number];

/**
 * Keeps only predictions backed by a source we actually sent (no "brand rules" claim when
 * there are none), drops duplicates, puts "high" first and caps the list.
 */
export function sanitizePredictions(out: PreflightOutput, c: { brief: string; brandRules: string; memory: MemoryLine[] }): Prediction[] {
  const has = { brief: Boolean(c.brief.trim()), brand_rules: Boolean(c.brandRules.trim()), past_feedback: c.memory.length > 0 };
  const seen = new Set<string>();
  const kept = out.predictions.filter((p) => {
    const key = norm(p.feedback);
    if (!key || seen.has(key) || !has[p.basis]) return false;
    seen.add(key);
    return true;
  });
  return kept
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.likelihood === b.p.likelihood ? a.i - b.i : a.p.likelihood === "high" ? -1 : 1))
    .slice(0, MAX_PREDICTIONS)
    .map(({ p }) => ({ ...p, feedback: p.feedback.trim().slice(0, 200), evidence: p.evidence.trim().slice(0, 240) }));
}

export const BASIS_LABEL: Record<Prediction["basis"], string> = {
  brief: "Brief",
  brand_rules: "Brand rules",
  past_feedback: "Asked before",
};
