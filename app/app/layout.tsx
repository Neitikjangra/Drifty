import Link from "next/link";
import { Suspense } from "react";
import { FolderKanban, LifeBuoy, LogOut, Users } from "lucide-react";
import { getCaller } from "@/lib/access";
import { Logo } from "@/components/brand/logo";
import { PushToggle } from "@/components/push-toggle";

const NAV = "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors sm:px-3";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
          <Link href="/app" aria-label="Drifty projects">
            <Logo compact />
          </Link>
          <Suspense fallback={null}>
            <AccountBar />
          </Suspense>
        </div>
      </header>
      <Suspense
        fallback={
          <p className="text-muted-foreground p-8 text-center text-sm" role="status">
            Loading…
          </p>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}

async function AccountBar() {
  const caller = await getCaller();
  if (caller.kind !== "member") return null;
  return (
    <div className="flex min-w-0 items-center gap-1 text-sm">
      {caller.membership && (
        <span className="text-muted-foreground mr-2 hidden max-w-48 truncate rounded-full border px-3 py-1 text-xs lg:inline">{caller.membership.workspace.name}</span>
      )}
      <nav className="bg-card flex items-center gap-0.5 rounded-full border p-1" aria-label="App">
        <Link href="/app" className={NAV} aria-label="Projects">
          <FolderKanban className="size-4" aria-hidden />
          <span className="hidden sm:inline">Projects</span>
        </Link>
        {caller.membership && (
          <Link href="/app/team" className={NAV} aria-label="Team">
            <Users className="size-4" aria-hidden />
            <span className="hidden sm:inline">Team</span>
          </Link>
        )}
        <Link href="/help" className={NAV} aria-label="Help">
          <LifeBuoy className="size-4" aria-hidden />
          <span className="hidden sm:inline">Help</span>
        </Link>
      </nav>
      {caller.profile && (
        <span className="ml-1 inline-flex">
          <PushToggle compact />
        </span>
      )}
      <form action="/auth/signout" method="post">
        <button type="submit" className={NAV} aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
