import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getCaller } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { guestProjectIds, listArchivedProjects, listProjects } from "@/lib/db/repo";
import { clientLimit } from "@/lib/plans";
import { ArrowUpRight, FolderPlus, MessagesSquare, UserCheck, UserPlus } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
import { listTeam, projectIdsFor } from "@/lib/team/server";
import { AddDemoButton } from "./add-demo-button";
import { TimeSavedCard } from "@/components/time-saved-card";
import { loadWorkspaceTimeSaved } from "@/lib/dashboard/time-saved-load";
import { ArchiveButton } from "./archive-button";
import { NewProjectForm } from "./new-project-form";

export const metadata: Metadata = { title: "Projects · Drifty" };

export default function ProjectsPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading projects…" />}>
      <Projects />
    </Suspense>
  );
}

async function Projects() {
  const caller = await getCaller();
  // A client opening the installed app (it starts at /app) goes straight to their room.
  if (caller.kind === "guest") {
    const [first] = await guestProjectIds(caller.userId);
    redirect(first ? `/room/${first}` : "/login");
  }
  if (caller.kind !== "member") redirect("/login");
  if (!caller.membership) redirect("/app/onboarding");

  const ws = caller.membership.workspace;
  const [allProjects, allArchived, saved, mine, team] = await Promise.all([
    listProjects(ws.id),
    listArchivedProjects(ws.id),
    loadWorkspaceTimeSaved(ws.id),
    caller.membership.role === "creative" ? projectIdsFor(caller.userId) : Promise.resolve(null),
    canManageProjects(caller.membership.role) ? listTeam(ws.id) : Promise.resolve([]),
  ]);
  const creatives = team.filter((m) => m.role === "creative").map((m) => ({ userId: m.userId, name: m.name }));
  // Creatives see only the projects they're on.
  const projects = mine ? allProjects.filter((p) => mine.has(p.id)) : allProjects;
  const archived = mine ? allArchived.filter((p) => mine.has(p.id)) : allArchived;
  const canCreate = canManageProjects(caller.membership.role);
  const limit = clientLimit(ws.plan);
  const activeClients = projects.filter((p) => !p.is_demo).length;
  const hasDemo = [...projects, ...archived].some((p) => p.is_demo);
  const support = process.env.SUPPORT_EMAIL?.trim();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">One project per client: a client room, an internal room and their drafts.</p>
          {limit !== null && (
            <p className="text-muted-foreground mt-1 text-xs">
              Free plan: {activeClients} of {limit} active clients
              {activeClients >= limit && (
                <>
                  {" · "}
                  {support ? (
                    <a className="underline" href={`mailto:${support}?subject=Drifty%20Pilot%20plan`}>
                      Ask about the Pilot plan
                    </a>
                  ) : (
                    <Link className="underline" href="/#pricing">
                      See the Pilot plan
                    </Link>
                  )}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && !hasDemo && <AddDemoButton />}
          {canCreate && <NewProjectForm hasProjects={projects.length > 0} creatives={creatives} />}
        </div>
      </div>

      <TimeSavedCard data={saved} scope="workspace" />

      {projects.length === 0 ? (
        <div className="bg-card flex flex-col items-center rounded-2xl border border-dashed p-10 text-center">
          <IconBadge icon={FolderPlus} size="lg" />
          <p className="mt-3 font-medium">No projects yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {canCreate ? "Tap Create your first project above. Drifty sets up both rooms for you." : "Your team hasn't created any projects yet."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/projects/${p.id}`}
                className="group bg-card hover:border-primary/50 flex h-full items-start gap-3 rounded-2xl border p-4 transition-colors"
              >
                <IconBadge icon={MessagesSquare} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{p.client_name}</span>
                    {p.is_demo && <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">DEMO</span>}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Created {new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className={`mt-2 inline-flex items-center gap-1 text-xs ${p.approver_id ? "text-primary" : "text-amber-200"}`}>
                    {p.approver_id ? <UserCheck className="size-3.5" aria-hidden /> : <UserPlus className="size-3.5" aria-hidden />}
                    {p.approver_id ? "Approver set" : "No approver yet"}
                  </p>
                </div>
                <ArrowUpRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-medium">Archived</h2>
          <ul className="bg-card divide-y rounded-2xl border">
            {archived.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <Link href={`/app/projects/${p.id}`} className="min-w-0 truncate hover:underline">
                  {p.client_name}
                </Link>
                {canCreate && <ArchiveButton projectId={p.id} archived />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
