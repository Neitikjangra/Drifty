"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { reportClientError } from "@/lib/observability/client-report";

/** Friendly error screen for any page (PRD section 7: error states everywhere). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        We couldn&apos;t load this page. Your work is saved. Try again, or go back to your projects.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/app" className={buttonVariants({ variant: "outline" })}>
          Projects
        </Link>
      </div>
      {error.digest && <p className="text-muted-foreground text-xs">Reference: {error.digest}</p>}
    </main>
  );
}
