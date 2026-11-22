import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { SupportEmail } from "./support";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" aria-label="Drifty home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/#how" className="text-muted-foreground hidden px-2 hover:underline sm:inline">
            How it works
          </Link>
          <Link href="/#pricing" className="text-muted-foreground hidden px-2 hover:underline sm:inline">
            Pricing
          </Link>
          <Link href="/help" className="text-muted-foreground hidden px-2 hover:underline sm:inline">
            Help
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
          <Link href="/login?mode=signup" className={buttonVariants({ size: "sm" })}>
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t text-sm">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6">
        <p>© 2026 Drifty</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
          <Link href="/#faq" className="hover:underline">
            FAQ
          </Link>
          <Link href="/help" className="hover:underline">
            Help
          </Link>
          <span>
            Support: <SupportEmail fallback="via the app" subject="Drifty support" />
          </span>
        </nav>
      </div>
    </footer>
  );
}
