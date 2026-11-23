"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

type Home = { home: string | null; kind: "member" | "guest" | "anonymous" };

let cached: Promise<Home> | null = null;
function loadHome(): Promise<Home> {
  cached ??= fetch("/api/me/home", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Home>) : { home: null, kind: "anonymous" as const }))
    .catch(() => ({ home: null, kind: "anonymous" as const }));
  return cached;
}

function useHome(): Home | null {
  const [home, setHome] = useState<Home | null>(null);
  useEffect(() => {
    let alive = true;
    void loadHome().then((h) => alive && setHome(h));
    return () => {
      alive = false;
    };
  }, []);
  return home;
}

/** The logo: signed-in people go back to their projects (or room), everyone else to the home page. */
export function HomeLogo() {
  const h = useHome();
  const href = h?.home ?? "/";
  return (
    <Link href={href} aria-label={h?.home ? "Back to Drifty" : "Drifty home"}>
      <Logo />
    </Link>
  );
}

/** Sign in / Start free for visitors; "Open my projects" (or "Open my room") when signed in. */
export function AccountLinks() {
  const h = useHome();
  if (h?.home) {
    return (
      <Link href={h.home} className={buttonVariants({ size: "sm" })}>
        {h.kind === "guest" ? "Open my room" : "Open my projects"}
      </Link>
    );
  }
  return (
    <>
      <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Sign in
      </Link>
      <Link href="/login?mode=signup" className={buttonVariants({ size: "sm" })}>
        Start free
      </Link>
    </>
  );
}
