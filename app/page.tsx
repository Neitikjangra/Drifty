import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { SupportEmail } from "@/components/marketing/support";

export const metadata: Metadata = {
  title: "Drifty · Client feedback that doesn't drift",
  description:
    "Chat-first client rooms for agencies. AI turns client messages and voice notes into a confirmed change list, catches versions that miss a change, and records every approval.",
};

const DRIFTS = [
  {
    title: "Feedback drift",
    body: "Requests scattered across messages and voice notes, or two client people asking for opposite things. Drifty collects them into one change list and asks the approver to settle conflicts.",
  },
  {
    title: "Version drift",
    body: "A new version that misses, or quietly undoes, a requested change. Drifty checks every new version against the confirmed list before the client sees it.",
  },
  {
    title: "Approval drift",
    body: "“I never approved that.” Only the named approver can approve, and every approval is recorded with the exact copy and file.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Invite your client to a room",
    body: "Create a project and send the client a personal link. It opens on their phone, with no app or account to set up. Your team gets a private internal room next to it.",
  },
  {
    n: "2",
    title: "Post the draft, let them talk",
    body: "Clients reply as they already do: text, Hindi or English voice notes, replies on the draft. Press Summarise and Drifty AI turns it into a change list you confirm.",
  },
  {
    n: "3",
    title: "Catch drift, get a clean approval",
    body: "Upload the next version: Drifty flags anything missed before it reaches the client. The approver taps Approve, and it's in your ledger, exportable as CSV.",
  },
];

const FAQ = [
  {
    q: "Do my clients need to install anything or create an account?",
    a: "No. Each client person gets a personal link that opens the room in their phone's browser. The link works for 30 days, and you can cancel or re-issue it at any time.",
  },
  {
    q: "Does the AI talk to my clients or approve anything?",
    a: "No. Drifty AI suggests; your team decides. It only messages the client to ask the approver to settle conflicting requests. It never approves work and never sends a brief without your confirmation.",
  },
  {
    q: "Can clients send voice notes in Hindi?",
    a: "Yes. Voice notes in Hindi, English or a mix are transcribed and included in the change list, with a link back to the original note.",
  },
  {
    q: "What exactly does the approval ledger record?",
    a: "Who approved, which version, when, the exact caption or copy, and a fingerprint (SHA-256) of the approved file. Entries can't be edited or deleted.",
  },
  {
    q: "Who can see the internal room?",
    a: "Only your team. Clients are only ever added to the client room. This is checked on our servers, not just hidden in the app.",
  },
  {
    q: "What happens to our data?",
    a: "Chat runs on Nexconn, files and records are stored with Supabase, and the AI features use Google's Gemini API. See the privacy policy for details and how to ask for deletion.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-4 pt-14 pb-12 sm:pt-20">
          <p className="text-muted-foreground text-sm font-medium">For agencies and freelancers</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Client feedback that doesn&apos;t drift.</h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
            Drifty is the room where client feedback actually happens. AI turns messages and voice notes into a confirmed change list,
            catches versions that miss a change, and records every approval.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login?mode=signup" className={buttonVariants({ size: "lg" })}>
              Start free
            </Link>
            <Link href="#how" className={buttonVariants({ size: "lg", variant: "outline" })}>
              See how it works
            </Link>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">Free for 2 active clients. Includes a demo project to try in 5 minutes.</p>
          <p className="bg-secondary text-dark-teal-500 mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            🇮🇳 Understands Hindi &amp; Hinglish: “logo thoda bada karo” becomes “Increase the logo size”
          </p>
        </section>

        {/* The drifts */}
        <section className="bg-muted/40 border-y">
          <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-12 sm:grid-cols-3">
            {DRIFTS.map((d) => (
              <div key={d.title} className="bg-background rounded-lg border p-4">
                <h2 className="font-semibold">{d.title}</h2>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{d.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-16 px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="space-y-2">
                <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm font-semibold">{s.n}</span>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-muted/40 scroll-mt-16 border-y">
          <div className="mx-auto w-full max-w-5xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
            <p className="text-muted-foreground mt-1 text-sm">Priced per agency, not per client.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="bg-background rounded-lg border p-5">
                <h3 className="font-semibold">Free</h3>
                <p className="mt-1 text-3xl font-semibold">₹0</p>
                <ul className="text-muted-foreground mt-4 space-y-1.5 text-sm">
                  <li>✓ 2 active clients (archive finished ones any time)</li>
                  <li>✓ Unlimited team members and client people</li>
                  <li>✓ AI change lists, conflict checks and drift checks</li>
                  <li>✓ Approval ledger with CSV export</li>
                  <li>✓ Demo project included</li>
                </ul>
                <Link href="/login?mode=signup" className={`${buttonVariants()} mt-5 w-full`}>
                  Start free
                </Link>
              </div>
              <div className="bg-background rounded-lg border-2 border-dark-teal-500 p-5 dark:border-dark-teal-800">
                <h3 className="font-semibold">Pilot</h3>
                <p className="mt-1 text-3xl font-semibold">Let&apos;s talk</p>
                <ul className="text-muted-foreground mt-4 space-y-1.5 text-sm">
                  <li>✓ Everything in Free</li>
                  <li>✓ More active clients</li>
                  <li>✓ Help moving your current clients over</li>
                  <li>✓ Direct line to the team building Drifty</li>
                </ul>
                <p className="mt-5 text-sm">
                  Contact <SupportEmail fallback="us from inside the app" subject="Drifty Pilot plan" />.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-16 px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-6 divide-y rounded-lg border">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-4">
                <summary className="cursor-pointer list-none font-medium">
                  <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                  {f.q}
                </summary>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Try it on a demo client in 5 minutes</h2>
          <p className="text-muted-foreground mt-2 text-sm">Sign up, and Drifty sets up a sample client with real feedback for you to work through.</p>
          <Link href="/login?mode=signup" className={`${buttonVariants({ size: "lg" })} mt-5`}>
            Start free
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
