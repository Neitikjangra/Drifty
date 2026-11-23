import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileSearch,
  GitCompareArrows,
  Languages,
  MessagesSquare,
  Mic,
  ShieldCheck,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Eyebrow, IconBadge } from "@/components/ui/icon-badge";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { SupportEmail } from "@/components/marketing/support";

export const metadata: Metadata = {
  title: "Drifty · Stop chasing client feedback on WhatsApp",
  description:
    "Chat-first client rooms for agencies. AI turns client messages and voice notes into a confirmed change list, catches versions that miss a change, and records every approval.",
};

const DRIFTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MessagesSquare,
    title: "Feedback drift",
    body: "Requests scattered across messages and voice notes, or two client people asking for opposite things. Drifty collects them into one change list and asks the approver to settle conflicts.",
  },
  {
    icon: GitCompareArrows,
    title: "Version drift",
    body: "A new version that misses, or quietly undoes, a requested change. Drifty checks every new version against the confirmed list before the client sees it.",
  },
  {
    icon: BadgeCheck,
    title: "Approval drift",
    body: "“I never approved that.” Only the named approver can approve, and every approval is recorded with the exact copy and file.",
  },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Mic, title: "Voice notes, transcribed", body: "Hindi, English or Hinglish voice notes become text in the change list." },
  { icon: FileSearch, title: "Pre-flight check", body: "Predicts what this client will say before you send the draft." },
  { icon: ShieldCheck, title: "Private internal room", body: "Your team talks next to the client room. Clients never see it." },
  { icon: Languages, title: "Built for India", body: "“logo thoda bada karo” becomes “Increase the logo size”." },
];

const STEPS = [
  {
    n: "01",
    title: "Invite your client to a room",
    body: "Create a project and send the client a personal link. It opens on their phone, with no app or account to set up. Your team gets a private internal room next to it.",
  },
  {
    n: "02",
    title: "Post the draft, let them talk",
    body: "Clients reply as they already do: text, Hindi or English voice notes, replies on the draft. Press Summarise and Drifty AI turns it into a change list you confirm.",
  },
  {
    n: "03",
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

const FREE = ["2 active clients (archive finished ones any time)", "Unlimited team members and client people", "AI change lists, conflict checks and drift checks", "Approval ledger with CSV export", "Demo project included"];
const PILOT = ["Everything in Free", "More active clients", "Help moving your current clients over", "Direct line to the team building Drifty"];

function Ticks({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2 text-sm">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="text-muted-foreground">{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="lime-glow relative overflow-hidden">
          <div className="mx-auto w-full max-w-5xl px-4 pt-16 pb-14 text-center sm:pt-24">
            <Eyebrow>
              <Sparkles className="mr-1.5 size-3.5" aria-hidden /> For agencies and freelancers
            </Eyebrow>
            <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Stop chasing client feedback on <span className="text-primary">WhatsApp.</span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
              Drifty is the room where client feedback actually happens. AI turns messages and voice notes into a confirmed change list,
              catches versions that miss a change, and records every approval.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/login?mode=signup" className={buttonVariants({ size: "lg" })}>
                Start free <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/login?mode=signup&demo=1" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Try the live demo
              </Link>
            </div>
            <p className="text-muted-foreground mt-4 text-xs">Free for 2 active clients. Includes a demo project to try in 5 minutes.</p>
          </div>
        </section>

        {/* The drifts */}
        <section className="mx-auto w-full max-w-5xl px-4 py-14">
          <div className="text-center">
            <Eyebrow>Why Drifty</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Three kinds of drift. <span className="text-primary">One room.</span>
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {DRIFTS.map((d) => (
              <div key={d.title} className="bg-card hover:border-primary/40 rounded-2xl border p-5 transition-colors">
                <IconBadge icon={d.icon} />
                <h3 className="mt-4 font-semibold">{d.title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{d.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card flex gap-3 rounded-2xl border p-4">
                <IconBadge icon={f.icon} size="sm" />
                <div>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y bg-[#0f1012] scroll-mt-16">
          <div className="mx-auto w-full max-w-5xl px-4 py-14">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">From first draft to approval in three steps</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="bg-card rounded-2xl border p-5">
                  <span className="text-primary font-mono text-sm font-semibold">{s.n}</span>
                  <h3 className="mt-2 font-semibold">{s.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="bg-accent mt-6 flex items-start gap-3 rounded-2xl border border-lime-400/20 p-4 text-sm">
              <IconBadge icon={Timer} size="sm" />
              <p>
                <b className="text-primary">Time saved, shown in your dashboard.</b>{" "}
                <span className="text-muted-foreground">
                  Drifty estimates ~10 min saved per AI change list, ~15 min per conflict or missed change caught and ~5 min per approval
                  recorded, so you can see what it&apos;s worth on every project.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto w-full max-w-5xl scroll-mt-16 px-4 py-14">
          <div className="text-center">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Priced per agency, not per client</h2>
          </div>
          <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
            <div className="bg-card rounded-2xl border p-6">
              <h3 className="font-semibold">Free</h3>
              <p className="mt-1 text-4xl font-bold">₹0</p>
              <Ticks items={FREE} />
              <Link href="/login?mode=signup" className={`${buttonVariants()} mt-6 w-full`}>
                Start free
              </Link>
            </div>
            <div className="bg-primary text-primary-foreground rounded-2xl p-6">
              <h3 className="font-semibold">Pilot</h3>
              <p className="mt-1 text-4xl font-bold">Let&apos;s talk</p>
              <ul className="mt-5 space-y-2 text-sm">
                {PILOT.map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm font-medium [&_a]:underline">
                Contact <SupportEmail fallback="us from inside the app" subject="Drifty Pilot plan" />.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-16 px-4 pb-14">
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Questions</h2>
          </div>
          <div className="mt-8 space-y-2">
            {FAQ.map((f) => (
              <details key={f.q} className="group bg-card open:border-primary/40 rounded-2xl border p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                  {f.q}
                  <span className="text-primary text-lg leading-none transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lime-glow border-t">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Try it on a demo client in <span className="text-primary">5 minutes</span>
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">Sign up, and Drifty sets up a sample client with real feedback for you to work through.</p>
            <Link href="/login?mode=signup" className={`${buttonVariants({ size: "lg" })} mt-6`}>
              Start free <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
