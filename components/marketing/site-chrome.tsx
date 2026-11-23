import Link from "next/link";
import { AccountLinks, HomeLogo } from "./home-link";
import { SupportEmail } from "./support";

const NAV = "text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 transition-colors hover:bg-muted";

export function SiteHeader() {
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <HomeLogo />
        <nav className="bg-card hidden items-center gap-0.5 rounded-full border p-1 text-sm sm:flex" aria-label="Main">
          <Link href="/#how" className={NAV}>
            How it works
          </Link>
          <Link href="/#pricing" className={NAV}>
            Pricing
          </Link>
          <Link href="/help" className={NAV}>
            Help
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          <AccountLinks />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t bg-[#0f1012] text-sm">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6">
        <p>© 2026 Drifty · Made for agencies in India</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:text-primary">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-primary">
            Terms
          </Link>
          <Link href="/#faq" className="hover:text-primary">
            FAQ
          </Link>
          <Link href="/help" className="hover:text-primary">
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
