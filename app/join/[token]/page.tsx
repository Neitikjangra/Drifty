import type { Metadata } from "next";
import { Suspense } from "react";
import { resolveInvite } from "@/lib/invites";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join your room · Drifty", robots: { index: false } };

const PROBLEM: Record<string, { title: string; body: string }> = {
  invalid: { title: "This link doesn't work", body: "Check you copied the whole link. Ask your agency for a new link." },
  expired: { title: "This link has expired", body: "Links last 30 days. Ask your agency for a new link." },
  revoked: { title: "This link was cancelled", body: "Ask your agency for a new link." },
};

export default function JoinPage({ params }: PageProps<"/join/[token]">) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Suspense fallback={<p className="text-muted-foreground text-sm">Checking your invite…</p>}>
        <JoinContent params={params} />
      </Suspense>
    </main>
  );
}

async function JoinContent({ params }: { params: PageProps<"/join/[token]">["params"] }) {
  const { token } = await params;
  const resolved = await resolveInvite(token).catch(() => ({ state: "error" as const }));

  if (resolved.state === "error") {
    return <Problem title="We couldn't check this invite" body="Please refresh the page in a moment." />;
  }
  if (resolved.state !== "ok") {
    const p = PROBLEM[resolved.state];
    return <Problem title={p.title} body={p.body} />;
  }
  return (
    <JoinForm
      token={token}
      agencyName={resolved.agencyName}
      projectName={resolved.project.client_name}
      role={resolved.invite.role}
      suggestedName={resolved.invite.display_name ?? ""}
      returningName={resolved.returningName}
    />
  );
}

function Problem({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-sm space-y-2 text-center" role="alert">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm">{body}</p>
    </div>
  );
}
