import "server-only";
import { AiError, generateJson } from "@/lib/ai/gemini";
import { AI4_SYSTEM, ai4Prompt } from "@/lib/ai/prompts";
import { preflightJsonSchema, preflightSchema } from "@/lib/ai/schemas";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Project } from "@/lib/db/types";
import { downloadAsset } from "@/lib/storage";
import { hasContext, sanitizePredictions, tasteMemory, type MemoryLine, type PastRequest, type Prediction } from "./rules";

const VISION_MIME = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_INLINE = 7 * 1024 * 1024;

export type PreflightResult =
  | { state: "ok"; predictions: Prediction[]; memoryCount: number; usedImage: boolean }
  | { state: "no_context"; memoryCount: 0 }
  | { state: "ai_unavailable"; error: string; memoryCount: number };

/** The client's accepted change requests across this project, as taste memory. */
export async function loadTasteMemory(projectId: string): Promise<MemoryLine[]> {
  const { data, error } = await supabaseAdmin()
    .from("change_items")
    .select("text, type, status, created_at, versions!inner(number, deliverables!inner(title, project_id))")
    .eq("versions.deliverables.project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`loadTasteMemory ${error.code ?? ""}`);
  const rows = (data ?? []) as unknown as {
    text: string;
    type: string;
    status: string;
    created_at: string;
    versions: { number: number; deliverables: { title: string } };
  }[];
  return tasteMemory(
    rows.map<PastRequest>((r) => ({
      text: r.text,
      type: r.type,
      status: r.status,
      createdAt: r.created_at,
      version: r.versions.number,
      deliverableTitle: r.versions.deliverables.title,
    })),
  );
}

export async function loadBrandRules(projectId: string): Promise<string> {
  const { data } = await supabaseAdmin().from("projects").select("brand_rules").eq("id", projectId).maybeSingle();
  return (data as { brand_rules: string } | null)?.brand_rules ?? "";
}

/**
 * AI-4: predicts the client's feedback on a draft before it is sent (team only; the client
 * never sees this). Doesn't call the AI when there's nothing client-specific to go on.
 */
export async function runPreflight(input: {
  project: Project;
  runBy: string;
  title: string;
  version: number;
  copy: string;
  brief: string;
  deliverableId: string | null;
  asset: { path: string; mime: string; sha256: string };
}): Promise<PreflightResult> {
  const [brandRules, memory] = await Promise.all([loadBrandRules(input.project.id), loadTasteMemory(input.project.id)]);
  const ctx = { brief: input.brief, brandRules, memory };
  if (!hasContext(ctx)) return { state: "no_context", memoryCount: 0 };

  let media: { mimeType: string; data: Uint8Array; label: string }[] = [];
  if (VISION_MIME.has(input.asset.mime)) {
    const bytes = await downloadAsset(input.asset.path).catch(() => null);
    if (bytes && bytes.byteLength <= MAX_INLINE) media = [{ mimeType: input.asset.mime, data: bytes, label: "Draft:" }];
  }

  let predictions: Prediction[];
  try {
    const out = await generateJson({
      task: "ai4-preflight",
      system: AI4_SYSTEM,
      prompt: ai4Prompt({ title: input.title, version: input.version, copy: input.copy, brief: input.brief, brandRules, memory, image: media.length > 0 }),
      jsonSchema: preflightJsonSchema,
      zod: preflightSchema,
      thinking: "medium",
      media,
    });
    predictions = sanitizePredictions(out, ctx);
  } catch (err) {
    const msg = err instanceof AiError ? err.message.replace("Couldn't summarise", "Couldn't run the pre-flight check") : "Couldn't run the pre-flight check, try again.";
    return { state: "ai_unavailable", error: msg, memoryCount: memory.length };
  }

  await supabaseAdmin()
    .from("preflight_checks")
    .insert({ project_id: input.project.id, deliverable_id: input.deliverableId, run_by: input.runBy, asset_sha256: input.asset.sha256, predictions })
    .then(({ error }) => error && console.warn("[preflight] not recorded"));
  return { state: "ok", predictions, memoryCount: memory.length, usedImage: media.length > 0 };
}
