import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getCaller } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { listTeam, listTeamInvites } from "@/lib/team/server";
import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Team · Drifty" };

export default function TeamPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading your team…" />}>
      <Team />
    </Suspense>
  );
}

async function Team() {
  const caller = await getCaller();
  if (caller.kind !== "member") redirect("/login");
  if (!caller.membership) redirect("/app/onboarding");
  const ws = caller.membership.workspace;
  const canInvite = canManageProjects(caller.membership.role);
  const [members, invites] = await Promise.all([listTeam(ws.id), canInvite ? listTeamInvites(ws.id) : Promise.resolve([])]);
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6">
      <div>
        <Link href="/app" className="text-muted-foreground text-sm hover:underline">
          ← Projects
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground text-sm">
          Account managers see every project and both rooms. Creatives see only the projects you put them on, and only the internal room.
        </p>
      </div>
      <TeamManager
        members={members.map((m) => ({ userId: m.userId, role: m.role, name: m.name, email: m.email, you: m.userId === caller.userId }))}
        invites={invites.map((i) => ({ id: i.id, role: i.role, expiresAt: i.expires_at }))}
        canInvite={canInvite}
        isOwner={caller.membership.role === "owner"}
      />
    </main>
  );
}
