import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { getAgencyUser } from "@/lib/auth/session";
import { getMembership, getProfile } from "@/lib/db/repo";
import { roleLabel, TEAM_INVITE_MESSAGES } from "@/lib/team/rules";
import { resolveTeamInvite } from "@/lib/team/server";
import { TeamJoinForm } from "./team-join-form";

export const metadata: Metadata = { title: "Join your team · Drifty", robots: { index: false } };

export default function TeamJoinPage({ params }: PageProps<"/team/join/[token]">) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Suspense fallback={<p className="text-muted-foreground text-sm">Opening your invite…</p>}>
        <TeamJoin params={params} />
      </Suspense>
    </main>
  );
}

async function TeamJoin({ params }: { params: PageProps<"/team/join/[token]">["params"] }) {
  const { token } = await params;
  const inv = await resolveTeamInvite(token).catch(() => ({ state: "invalid" as const }));
  if (inv.state !== "ok") {
    return (
      <div className="max-w-sm space-y-2 text-center" role="alert">
        <h1 className="text-xl font-semibold">This link doesn&apos;t work</h1>
        <p className="text-muted-foreground text-sm">{inv.state === "invalid" ? "Check you copied the whole link, or ask for a new one." : TEAM_INVITE_MESSAGES[inv.state]}</p>
      </div>
    );
  }
  const user = await getAgencyUser();
  const here = `/team/join/${token}`;
  const header = (
    <div className="space-y-1 text-center">
      <p className="text-muted-foreground text-sm">You&apos;re invited to join</p>
      <h1 className="text-2xl font-semibold tracking-tight">{inv.workspaceName}</h1>
      <p className="text-muted-foreground text-sm">as {roleLabel(inv.role, inv.title).toLowerCase()} on Drifty</p>
    </div>
  );
  if (!user) {
    return (
      <div className="w-full max-w-sm space-y-5">
        {header}
        <Link href={`/login?next=${encodeURIComponent(here)}`} className={buttonVariants({ className: "h-11 w-full text-base" })}>
          Sign in or create an account
        </Link>
        <p className="text-muted-foreground text-center text-xs">Use your work email. You&apos;ll come straight back here.</p>
      </div>
    );
  }
  const [membership, profile] = await Promise.all([getMembership(user.id), getProfile(user.id)]);
  if (membership) {
    const same = membership.workspace.id === inv.workspaceId;
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        {header}
        <p className={same ? "text-sm" : "text-sm text-red-400"} role={same ? "status" : "alert"}>
          {same ? "You're already in this workspace." : `You're signed in to ${membership.workspace.name}. Sign out and use another email to join ${inv.workspaceName}.`}
        </p>
        <Link href="/app" className={buttonVariants({ variant: "outline", className: "w-full" })}>
          Go to my projects
        </Link>
      </div>
    );
  }
  return (
    <div className="w-full max-w-sm space-y-5">
      {header}
      <TeamJoinForm token={token} suggestedName={profile?.display_name ?? ""} />
    </div>
  );
}
