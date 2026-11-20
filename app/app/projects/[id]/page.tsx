import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { RoomView } from "@/components/chat/room-view";
import { getCaller, projectAccess } from "@/lib/access";
import { allowedRooms, canManageProjects } from "@/lib/auth/permissions";
import { listGuests, listInvites } from "@/lib/db/repo";
import type { Invite, ProjectGuest } from "@/lib/db/types";
import { PeoplePanel, type PeopleData } from "./people-panel";

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

export const metadata: Metadata = { title: "Project · Drifty" };

export default function ProjectPage({ params }: PageProps<"/app/projects/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Opening project…" />}>
      <ProjectContent params={params} />
    </Suspense>
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
  const [guests, invites] = await Promise.all([listGuests(project.id), canManage ? listInvites(project.id) : []]);
  const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? "";

  const tabs = [
    ...(rooms.client && project.client_channel_id
      ? [{ channelId: project.client_channel_id, label: "Client room", hint: "Your client sees this room." }]
      : []),
    ...(rooms.internal && project.internal_channel_id
      ? [{ channelId: project.internal_channel_id, label: "Internal", hint: "Team only. Clients never see this room." }]
      : []),
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link href="/app" className="text-muted-foreground text-sm hover:underline">
            ← Projects
          </Link>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{project.client_name}</h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        {tabs.length && appKey ? (
          <RoomView appKey={appKey} rooms={tabs} className="h-[70dvh] lg:h-auto lg:min-h-[560px] lg:flex-1" />
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border p-6 text-sm">
            This project&apos;s rooms aren&apos;t available right now.
          </div>
        )}
        <PeoplePanel projectId={project.id} canManage={canManage} approverId={project.approver_id} {...buildPeople(guests, invites)} />
      </div>
    </main>
  );
}
