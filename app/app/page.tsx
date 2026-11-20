import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getCaller } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { listProjects } from "@/lib/db/repo";
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
  if (caller.kind !== "member") redirect("/login");
  if (!caller.membership) redirect("/app/onboarding");

  const projects = await listProjects(caller.membership.workspace.id);
  const canCreate = canManageProjects(caller.membership.role);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">One project per client: a client room, an internal room and their drafts.</p>
        </div>
      </div>

      {canCreate && <NewProjectForm hasProjects={projects.length > 0} />}

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No projects yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {canCreate ? "Create your first client project above. Drifty sets up both rooms for you." : "Your team hasn't created any projects yet."}
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
                <p className="truncate font-medium">{p.client_name}</p>
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
    </main>
  );
}
