"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { DEMO } from "@/lib/demo/content";
import type { DemoProgress } from "@/lib/demo/progress";

/** Step-by-step guide for the seeded demo project (Round 5 first-run onboarding). */
export function DemoGuide({ projectId, progress }: { projectId: string; progress: DemoProgress }) {
  // The page's own origin (local, preview or production), without a hydration mismatch.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState("");
  const priya = progress.links.find((l) => l.role === "approver");
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  };
  const priyaUrl = priya && origin ? `${origin}${priya.path}` : "";

  const steps: { done: boolean; title: string; body: React.ReactNode }[] = [
    {
      done: progress.summarised,
      title: "Summarise the client's feedback",
      body: (
        <>
          Priya and Rahul already replied to v1 in the <b>Client room</b>. Press <b>Summarise feedback</b> on the Diwali post. Drifty
          AI posts a change list in <b>Internal</b> and spots that they disagree about the logo.
        </>
      ),
    },
    {
      done: progress.conflictSettled,
      title: "Settle the conflict as Priya (the approver)",
      body: progress.conflictSettled && !progress.hadConflict ? (
        <>No conflicting requests this time, so there&apos;s nothing for Priya to decide. Summarise again after new feedback to re-check.</>
      ) : (
        <>
          Open Priya&apos;s personal link on your phone or in a private window, then tap <b>Choose A</b> or <b>B</b> on the conflict
          card.{" "}
          {priyaUrl && (
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <button className="rounded border px-2 py-0.5 text-xs font-medium" onClick={() => copy("priya", priyaUrl)}>
                {copied === "priya" ? "Copied" : "Copy Priya's link"}
              </button>
              <a className="text-xs underline" href={priyaUrl} target="_blank" rel="noopener">
                Open (private window works best)
              </a>
            </span>
          )}
        </>
      ),
    },
    {
      done: progress.confirmed,
      title: "Confirm the changes",
      body: (
        <>
          In <b>Internal</b>, confirm the CTA change (edit or reject anything you disagree with), then <b>Send brief</b>.
        </>
      ),
    },
    {
      done: progress.uploadedV2,
      title: "Upload v2 that misses a change",
      body: (
        <>
          Download{" "}
          <a className="underline" href={DEMO.v2.image} download>
            demo v2
          </a>
          , press <b>Upload v2</b> and keep the copy ending in &ldquo;Buy now&rdquo;. Drifty holds it back from the client and the drift
          check flags the CTA as <b>Missing</b>.
        </>
      ),
    },
    {
      done: progress.sentToClient,
      title: "Fix it in v3 and send it",
      body: (
        <>
          Press <b>Back to creative</b>. Then upload{" "}
          <a className="underline" href={DEMO.v3.image} download>
            demo v3
          </a>{" "}
          with the copy ending in &ldquo;Order now&rdquo;{" "}
          <button className="rounded border px-1.5 text-xs" onClick={() => copy("v3", DEMO.v3.copy)}>
            {copied === "v3" ? "Copied" : "copy text"}
          </button>
          . When everything shows <b>Done</b>, press <b>Send v3 to client</b>.
        </>
      ),
    },
    {
      done: progress.approved,
      title: "Approve as Priya, then open the ledger",
      body: (
        <>
          On Priya&apos;s view, tap <b>Approve v3</b>. Then open the{" "}
          <Link className="underline" href={`/app/projects/${projectId}/ledger`}>
            Approval ledger
          </Link>{" "}
          and export the CSV.
        </>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <details open={doneCount < steps.length} className="rounded-lg border border-beige-400 bg-beige-500 p-3 text-sm dark:bg-dark-teal-300/40">
      <summary className="cursor-pointer font-medium">
        Demo guide · {doneCount} of {steps.length} done
      </summary>
      <ol className="mt-3 space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-2">
            <span
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${s.done ? "bg-dark-teal-500 text-beige-900" : "bg-beige-900 text-air-force-blue-300 ring-1 ring-ash-grey-500"}`}
              aria-label={s.done ? "Done" : `Step ${i + 1}`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <div className={s.done ? "text-muted-foreground" : ""}>
              <p className="font-medium">{s.title}</p>
              <div className="text-xs leading-relaxed">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground mt-3 text-xs">
        Tip: you&apos;re signed in as the agency, so Priya&apos;s link must open where you&apos;re not signed in (a phone or a private window).
      </p>
    </details>
  );
}
