import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RoomView } from "@/components/chat/room-view";
import { getCaller, projectAccess } from "@/lib/access";

export const metadata: Metadata = { title: "Your room · Drifty", robots: { index: false } };

/** The client's room: mobile-first, no navigation chrome, client room only (screen 9). */
export default function GuestRoomPage({ params }: PageProps<"/room/[projectId]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground p-6 text-center text-sm">Opening your room…</p>}>
      <GuestRoom params={params} />
    </Suspense>
  );
}

async function GuestRoom({ params }: { params: PageProps<"/room/[projectId]">["params"] }) {
  const { projectId } = await params;
  const caller = await getCaller();
  if (caller.kind === "member") redirect(`/app/projects/${projectId}`);
  const access = caller.kind === "guest" ? await projectAccess(projectId, caller) : null;

  if (!access || access.kind !== "guest" || !access.project.client_channel_id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-sm space-y-2 text-center" role="alert">
          <h1 className="text-xl font-semibold">You don&apos;t have access to this room</h1>
          <p className="text-muted-foreground text-sm">
            Open the invite link your agency sent you on this device, or ask them for a new one.
          </p>
        </div>
      </main>
    );
  }

  const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? "";
  return (
    <main className="flex h-dvh flex-col gap-2 p-2 sm:p-4">
      <header className="flex items-center justify-between gap-2 px-1">
        <h1 className="truncate text-base font-semibold">{access.project.client_name}</h1>
        {access.role === "approver" && <span className="text-muted-foreground text-xs">You&apos;re the approver</span>}
      </header>
      <RoomView
        appKey={appKey}
        rooms={[{ channelId: access.project.client_channel_id, label: "Room" }]}
        className="flex-1"
      />
    </main>
  );
}
