import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getCaller, projectAccess } from "@/lib/access";
import { ledgerRows } from "@/lib/ledger/rows";
import { LedgerTable } from "./ledger-table";

export const metadata: Metadata = { title: "Ledger · Drifty" };

export default function LedgerPage({ params }: PageProps<"/app/projects/[id]/ledger">) {
  return (
    <Suspense fallback={<PageLoading label="Opening the ledger…" />}>
      <LedgerContent params={params} />
    </Suspense>
  );
}

async function LedgerContent({ params }: { params: PageProps<"/app/projects/[id]/ledger">["params"] }) {
  const { id } = await params;
  const caller = await getCaller();
  if (caller.kind !== "member") redirect("/login");
  if (!caller.membership) redirect("/app/onboarding");
  const access = await projectAccess(id, caller);
  if (!access || access.kind !== "member") notFound();
  const rows = await ledgerRows(access.project.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="min-w-0">
        <Link href={`/app/projects/${access.project.id}`} className="text-muted-foreground text-sm hover:underline">
          ← {access.project.client_name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Approval ledger</h1>
        <p className="text-muted-foreground text-sm">
          Every approval, with the exact copy and file that were approved. Read-only: entries can&apos;t be edited or deleted.
        </p>
      </div>
      <LedgerTable projectId={access.project.id} rows={rows} />
    </main>
  );
}
