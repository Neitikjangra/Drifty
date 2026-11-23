"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/client-fetch";
import { BASIS_LABEL, type Prediction } from "@/lib/preflight/rules";
import type { PreflightResult } from "@/lib/preflight/run";

type Upload = (projectId: string, file: File) => Promise<string>;
type Run = { file: File; copy: string; title?: string; brief?: string; deliverableId?: string };

/**
 * Pre-flight check state for an upload form. The file is uploaded once: the same storage path
 * is reused when the draft is then posted, so checking first costs no second upload.
 */
export function usePreflight(projectId: string, upload: Upload) {
  const uploaded = useRef<{ file: File; path: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [error, setError] = useState("");

  async function pathFor(file: File): Promise<string> {
    if (uploaded.current?.file === file) return uploaded.current.path;
    const path = await upload(projectId, file);
    uploaded.current = { file, path };
    return path;
  }

  async function run(r: Run) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const assetPath = await pathFor(r.file);
      setResult(
        await apiJson<PreflightResult>("/api/preflight", {
          body: { projectId, assetPath, copy: r.copy, title: r.title, brief: r.brief, deliverableId: r.deliverableId },
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't run the pre-flight check.");
    } finally {
      setBusy(false);
    }
  }

  /** Call when the file or copy changes: the old result no longer applies. */
  function reset() {
    setResult(null);
    setError("");
  }

  const found = result?.state === "ok" ? result.predictions.length : 0;
  return { busy, result, error, run, reset, pathFor, found };
}

const AREA: Record<Prediction["area"], string> = { copy: "Copy", visual: "Visual", layout: "Layout", brand: "Brand", other: "Other" };

export function PreflightButton({ busy, disabled, onClick }: { busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={busy || disabled} title="Predict what this client will say before you send it">
      {busy ? "Checking…" : "Pre-flight check"}
    </Button>
  );
}

/** What the AI expects this client to say, with the evidence for each point. Team only. */
export function PreflightPanel({ busy, result, error }: { busy: boolean; result: PreflightResult | null; error: string }) {
  if (busy) {
    return (
      <p className="text-muted-foreground animate-pulse rounded-xl border p-2 text-xs" role="status">
        Checking against the brief, brand rules and this client&apos;s past feedback…
      </p>
    );
  }
  if (error) {
    return (
      <p className="rounded-xl border border-red-500/40 p-2 text-xs text-red-300" role="alert">
        {error}
      </p>
    );
  }
  if (!result) return null;
  if (result.state === "no_context") {
    return (
      <p className="text-muted-foreground rounded-xl border p-2 text-xs" role="status">
        Nothing to check against yet. Add a brief or this client&apos;s brand rules, or wait for their first feedback: Drifty
        learns their taste from every change they ask for.
      </p>
    );
  }
  if (result.state === "ai_unavailable") {
    return (
      <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-200" role="alert">
        {result.error} You can still post the draft.
      </p>
    );
  }
  const memory = result.memoryCount ? ` and ${result.memoryCount} past request${result.memoryCount === 1 ? "" : "s"}` : "";
  if (!result.predictions.length) {
    return (
      <p className="rounded-xl border border-lime-400/30 bg-lime-400/10 p-2 text-xs text-lime-200" role="status">
        Looks ready. No likely feedback found against the brief, brand rules{memory}.
      </p>
    );
  }
  return (
    <div className="space-y-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 p-2 text-amber-100" role="status" aria-label="Pre-flight check result">
      <p className="text-xs font-medium">
        Likely feedback ({result.predictions.length}) · fix now to save a round
      </p>
      <ul className="space-y-1.5">
        {result.predictions.map((p, i) => (
          <li key={i} className="text-xs">
            <span className="font-medium">{p.feedback}</span>
            <span className="ml-1 rounded bg-amber-400/20 px-1 text-[10px]">
              {AREA[p.area]} · {BASIS_LABEL[p.basis]}
              {p.likelihood === "high" ? " · likely" : ""}
            </span>
            {p.evidence && <span className="block text-amber-200/80">{p.evidence}</span>}
          </li>
        ))}
      </ul>
      {!result.usedImage && <p className="text-[10px] text-amber-200/70">Checked the copy only (this file type can&apos;t be read as an image).</p>}
    </div>
  );
}
