import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getCaller, projectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { loadMonthlyReport } from "@/lib/report/load";
import { formatDuration, monthLabel, parseMonth, shiftMonth } from "@/lib/report/rules";
import { ReportActions } from "./report-actions";

export const metadata: Metadata = { title: "Monthly report · Drifty" };

export default function ReportPage({ params, searchParams }: PageProps<"/app/projects/[id]/report">) {
  return (
    <Suspense fallback={<PageLoading label="Building the report…" />}>
      <Report params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-muted/40 rounded-xl border p-3 print:border-slate-300">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

async function Report({
  params,
  searchParams,
}: {
  params: PageProps<"/app/projects/[id]/report">["params"];
  searchParams: PageProps<"/app/projects/[id]/report">["searchParams"];
}) {
  const { id } = await params;
  const sp = await searchParams;
  const caller = await getCaller();
  if (caller.kind !== "member") redirect("/login");
  if (!caller.membership) redirect("/app/onboarding");
  const access = await projectAccess(id, caller);
  if (!access || access.kind !== "member") notFound();
  const month = parseMonth(typeof sp.month === "string" ? sp.month : null);
  const r = await loadMonthlyReport(access.project.id, month);
  const hasData = Boolean(r.approvals || r.versionsShipped || r.changesCaptured);
  const base = `/app/projects/${access.project.id}/report`;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6">
      <div className="print:hidden">
        <Link href={`/app/projects/${access.project.id}`} className="text-muted-foreground text-sm hover:underline">
          ← {access.project.client_name}
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">Monthly client report</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {access.project.client_name} · {monthLabel(month)}
          </h1>
        </div>
        <nav className="flex items-center gap-1 text-sm print:hidden" aria-label="Month">
          <Link className="rounded border px-2 py-1 hover:bg-muted" href={`${base}?month=${shiftMonth(month, -1)}`}>
            ← {monthLabel(shiftMonth(month, -1))}
          </Link>
          <Link className="rounded border px-2 py-1 hover:bg-muted" href={`${base}?month=${shiftMonth(month, 1)}`}>
            {monthLabel(shiftMonth(month, 1))} →
          </Link>
        </nav>
      </div>

      <ReportActions projectId={access.project.id} month={month} canShare={canManageProjects(access.role)} hasData={hasData} />

      {!hasData ? (
        <p className="text-muted-foreground rounded-2xl border p-6 text-center text-sm bg-card">
          Nothing happened in this project in {monthLabel(month)}. Pick another month above.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Deliverables approved" value={r.deliverablesApproved} hint={`${r.approvals} approval${r.approvals === 1 ? "" : "s"} recorded`} />
            <Stat label="Average revision rounds" value={r.avgRounds ?? "—"} hint="per approved deliverable" />
            <Stat label="Version → approval" value={formatDuration(r.avgHoursClientTurnaround)} hint="average client turnaround" />
            <Stat label="First draft → approval" value={r.avgDaysToApproval === null ? "—" : formatDuration(r.avgDaysToApproval * 24)} hint="average" />
            <Stat label="Versions shared" value={r.versionsShipped} />
            <Stat label="Changes captured" value={r.changesCaptured} hint="confirmed from client feedback" />
            <Stat label="Drifts caught" value={r.driftsCaught} hint="conflicts or missed changes" />
          </section>

          {r.lines.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">Approved this month</h2>
              <div className="overflow-x-auto rounded-2xl border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="p-2 font-medium">Deliverable</th>
                      <th className="p-2 font-medium">Approved</th>
                      <th className="p-2 font-medium">Rounds</th>
                      <th className="p-2 font-medium">Version → approval</th>
                      <th className="p-2 font-medium">First draft → approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines.map((l) => (
                      <tr key={`${l.title}-${l.approvedVersion}`} className="border-t">
                        <td className="p-2 font-medium">{l.title}</td>
                        <td className="p-2">v{l.approvedVersion}</td>
                        <td className="p-2">{l.rounds}</td>
                        <td className="p-2">{formatDuration(l.hoursClientTurnaround)}</td>
                        <td className="p-2">{formatDuration(l.daysToApproval * 24)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-muted-foreground border-t pt-3 text-xs">
        Figures come from this project&apos;s Drifty records (India time). Tracked with Drifty · drifty-six.vercel.app
      </p>
    </main>
  );
}
