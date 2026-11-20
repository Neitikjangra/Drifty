import Link from "next/link";
import { Suspense } from "react";
import { getCaller } from "@/lib/access";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/app" className="font-semibold tracking-tight">
            Drifty
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
    <div className="flex min-w-0 items-center gap-3 text-sm">
      {caller.membership && (
        <span className="text-muted-foreground hidden truncate sm:inline">{caller.membership.workspace.name}</span>
      )}
      <form action="/auth/signout" method="post">
        <button type="submit" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
