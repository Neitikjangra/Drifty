import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getCaller } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { guestProjectIds, listArchivedProjects, listProjects } from "@/lib/db/repo";
import { clientLimit } from "@/lib/plans";
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
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
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
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No projects yet</p>
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
                className="hover:bg-muted/50 block rounded-lg border p-4 transition-colors"
              >
                <p className="truncate font-medium">
                  {p.client_name}
                  {p.is_demo && <span className="ml-2 rounded bg-beige-400 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-beige-100">DEMO</span>}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Created {new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {" · "}
                  {p.approver_id ? "Approver set" : "No approver yet"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-medium">Archived</h2>
          <ul className="divide-y rounded-lg border">
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
