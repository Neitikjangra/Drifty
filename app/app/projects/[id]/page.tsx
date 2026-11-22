import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache, Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { RoomView } from "@/components/chat/room-view";
import { getCaller, projectAccess } from "@/lib/access";
import { allowedRooms, canManageProjects } from "@/lib/auth/permissions";
import { listGuests, listInvites } from "@/lib/db/repo";
import type { Invite, Project, ProjectGuest } from "@/lib/db/types";
import { PeoplePanel, type PeopleData } from "./people-panel";
import { DeliverablesPanel, type DeliverableRow } from "./deliverables-panel";
import { listDeliverables } from "@/lib/db/deliverables";
import { canUploadVersions } from "@/lib/auth/permissions";
import { latestVersionAlerts, type VersionAlert } from "@/lib/drift/check";
import { loadDashboard } from "@/lib/dashboard/load";
import { ProjectDashboard } from "./project-dashboard";
import { BrandRulesPanel } from "./brand-rules-panel";
import { loadBrandRules, loadTasteMemory } from "@/lib/preflight/run";
import { TimeSavedCard } from "@/components/time-saved-card";
import { loadTimeSaved } from "@/lib/dashboard/time-saved-load";
import { InternalSummariseBar } from "@/components/chat/internal-summarise";
import { DemoGuide } from "./demo-guide";
import { demoProgress } from "@/lib/demo/progress";
import { ArchiveButton } from "../../archive-button";
import { driftCounts, sendLabel } from "@/lib/drift/rules";

/** Groups invites by person: who's in the room, who hasn't joined, and dead links to re-issue. */
function buildPeople(guests: ProjectGuest[], invites: Invite[]): PeopleData {
  const now = Date.now();
  const alive = (i: Invite) => !i.revoked_at && new Date(i.expires_at).getTime() > now;
  // invites are newest first
  const members = guests.map((g) => {
    const mine = invites.filter((i) => i.used_by === g.user_id);
    const active = mine.find(alive);
    return {
      guestId: g.user_id,
      name: g.display_name,
      role: g.role,
      inviteId: (active ?? mine[0])?.id ?? null,
      linkActive: Boolean(active),
    };
  });
  const guestIds = new Set(guests.map((g) => g.user_id));
  const pending = invites
    .filter((i) => !i.used_by && alive(i))
    .map((i) => ({ inviteId: i.id, name: i.display_name ?? i.email_or_phone, contact: i.email_or_phone, role: i.role, expiresAt: i.expires_at }));
  const seen = new Set<string>();
  const past = invites
    .filter((i) => !alive(i))
    .filter((i) => !(i.used_by && guestIds.has(i.used_by)))
    .filter((i) => !invites.some((o) => o !== i && alive(o) && (i.used_by ? o.used_by === i.used_by : o.email_or_phone === i.email_or_phone)))
    .filter((i) => {
      const key = i.used_by ?? i.email_or_phone;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((i) => ({ inviteId: i.id, name: i.display_name ?? i.email_or_phone, status: i.revoked_at ? ("cancelled" as const) : ("expired" as const) }));
  return { members, pending, past };
}

function driftRow(a: VersionAlert | undefined, current: number): DeliverableRow["drift"] {
  if (!a || a.detail.toVersion !== current) return null;
  const results = a.detail.results ?? [];
  return {
    alertId: a.id,
    state: a.resolved_at ? (a.detail.decision ?? "sent") : a.detail.state,
    toVersion: a.detail.toVersion,
    checking: a.detail.itemIds.length,
    counts: results.length ? driftCounts(results) : null,
    sendLabel: sendLabel(results, a.detail.toVersion),
  };
}

export const metadata: Metadata = { title: "Project · Drifty" };

export default function ProjectPage({ params }: PageProps<"/app/projects/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Opening project…" />}>
      <ProjectContent params={params} />
    </Suspense>
  );
}

/** Per-request cache: the top panels and the side panels both need the deliverables. */
const getDeliverables = cache(listDeliverables);

function PanelLoading({ label, className }: { label: string; className?: string }) {
  return (
    <div className={`text-muted-foreground bg-muted/40 animate-pulse rounded-lg border p-4 text-sm ${className ?? ""}`} role="status">
      {label}
    </div>
  );
}

async function ProjectContent({ params }: { params: PageProps<"/app/projects/[id]">["params"] }) {
  const { id } = await params;
  const caller = await getCaller();
  if (caller.kind !== "member") redirect("/login");
  if (!caller.membership) redirect("/app/onboarding");
  const access = await projectAccess(id, caller);
  if (!access || access.kind !== "member") notFound();

  const { project, role } = access;
  const rooms = allowedRooms({ kind: "member", role });
  const canManage = canManageProjects(role);
  const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? "";

  const tabs = [
    ...(rooms.client && project.client_channel_id
      ? [{ channelId: project.client_channel_id, label: "Client room", hint: "Your client sees this room.", name: project.client_name }]
      : []),
    ...(rooms.internal && project.internal_channel_id
      ? [{ channelId: project.internal_channel_id, label: "Internal", hint: "Team only. Clients never see this room.", name: `${project.client_name} · internal` }]
      : []),
  ];

  // The header and the chat render as soon as access is checked; the panels stream in after,
  // so the chat starts connecting while the dashboard and deliverables load.
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link href="/app" className="text-muted-foreground text-sm hover:underline">
            ← Projects
          </Link>
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {project.client_name}
            {project.archived && <span className="text-muted-foreground ml-2 align-middle text-sm font-normal">(archived)</span>}
          </h1>
        </div>
        {canManage && <ArchiveButton projectId={project.id} archived={project.archived} redirectTo={project.archived ? undefined : "/app"} />}
      </div>

      <Suspense fallback={<PanelLoading label="Loading the dashboard…" className="h-28" />}>
        <TopPanels project={project} canManage={canManage} />
      </Suspense>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        {tabs.length && appKey ? (
          <RoomView
            appKey={appKey}
            rooms={tabs}
            projectId={project.id}
            canManage={canManage}
            className="h-[70dvh] lg:h-auto lg:min-h-[560px] lg:flex-1"
            internalBar={
              canManage ? (
                <Suspense fallback={null}>
                  <InternalSummarise projectId={project.id} clientChannelId={project.client_channel_id} />
                </Suspense>
              ) : undefined
            }
          />
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border p-6 text-sm">
            This project&apos;s rooms aren&apos;t available right now.
          </div>
        )}
        <div className="w-full space-y-4 lg:w-80 lg:shrink-0">
          <Suspense fallback={<PanelLoading label="Loading deliverables and people…" className="h-64" />}>
            <SidePanels project={project} canManage={canManage} canUpload={canUploadVersions(role)} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function TopPanels({ project, canManage }: { project: Project; canManage: boolean }) {
  const deliverables = await getDeliverables(project.id);
  const [dashboard, demo, saved] = await Promise.all([
    loadDashboard(deliverables, project.rounds_included),
    project.is_demo && canManage ? demoProgress(project.id) : Promise.resolve(null),
    loadTimeSaved(deliverables.map((d) => d.id)),
  ]);
  return (
    <>
      {demo && <DemoGuide projectId={project.id} progress={demo} />}
      <TimeSavedCard data={saved} scope="project" />
      <ProjectDashboard projectId={project.id} data={dashboard} canManage={canManage} />
    </>
  );
}

async function SidePanels({ project, canManage, canUpload }: { project: Project; canManage: boolean; canUpload: boolean }) {
  const [guests, invites, deliverables, brandRules, memory] = await Promise.all([
    listGuests(project.id),
    canManage ? listInvites(project.id) : [],
    getDeliverables(project.id),
    canUpload ? loadBrandRules(project.id) : Promise.resolve(""),
    canUpload ? loadTasteMemory(project.id).catch(() => []) : Promise.resolve([]),
  ]);
  const alerts = await latestVersionAlerts(deliverables.map((d) => d.id));
  const nameOf = new Map(guests.map((g) => [g.user_id, g.display_name]));
  const deliverableRows: DeliverableRow[] = deliverables.map((d) => {
    const current = d.versions.find((v) => v.number === d.current_version);
    const appr = d.approvals[0];
    const apprVersion = appr ? d.versions.find((v) => v.id === appr.version_id)?.number ?? d.current_version : 0;
    return {
      id: d.id,
      title: d.title,
      status: d.status,
      version: d.current_version,
      dueDate: d.due_date,
      copy: current?.copy_text ?? "",
      approval: appr ? { version: apprVersion, by: nameOf.get(appr.approver_id) ?? "Approver", at: appr.approved_at } : null,
      drift: driftRow(alerts.get(d.id), d.current_version),
    };
  });
  return (
    <>
      <DeliverablesPanel projectId={project.id} clientChannelId={project.client_channel_id} canCreate={canManage} canUpload={canUpload} hasApprover={Boolean(project.approver_id)} items={deliverableRows} />
      {canUpload && <BrandRulesPanel projectId={project.id} rules={brandRules} memoryCount={memory.length} canEdit={canManage} />}
      <PeoplePanel projectId={project.id} projectName={project.client_name} canManage={canManage} approverId={project.approver_id} {...buildPeople(guests, invites)} />
    </>
  );
}

/** Summarise shortcuts for the Internal room: deliverables in review or with changes requested. */
async function InternalSummarise({ projectId, clientChannelId }: { projectId: string; clientChannelId: string | null }) {
  const deliverables = await getDeliverables(projectId);
  const items = deliverables
    .filter((d) => d.status === "in_review" || d.status === "changes_requested")
    .map((d) => ({ id: d.id, title: d.title, version: d.current_version }));
  return <InternalSummariseBar projectId={projectId} clientChannelId={clientChannelId} items={items} />;
}
