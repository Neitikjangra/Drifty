import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { SupportEmail } from "@/components/marketing/support";

export const metadata: Metadata = { title: "Help · Drifty" };

const GUIDES = [
  {
    q: "Get started in 2 minutes",
    steps: [
      "Sign up and keep “Add a demo project” ticked. Follow the Demo guide on the demo project.",
      "Create your first real project with your client's name. Drifty sets up a client room and a private internal room.",
      "Invite your client: Client people → name + email or phone → Create invite link → Share on WhatsApp.",
      "Post your first draft: Deliverables → New deliverable → upload the image or PDF with its caption.",
    ],
  },
  {
    q: "Turn client feedback into a change list",
    steps: [
      "Let the client reply in the client room: text or voice notes, in English, Hindi or Hinglish.",
      "Press Summarise feedback on the deliverable (or in the Internal room). Each item quotes the client's words.",
      "Confirm, edit or reject each item, then press Send brief for your creative.",
    ],
  },
  {
    q: "Upload a new version and catch missed changes",
    steps: [
      "Press Upload v2 on the deliverable. If changes were confirmed, Drifty holds it back from the client and checks it.",
      "The drift check marks each change Done, Missing, Reversed or Check by eye.",
      "Press Send to client, or Back to creative to fix what's missing first.",
    ],
  },
  {
    q: "Catch feedback before the client gives it",
    steps: [
      "Add the client's rules under Brand rules & taste on the project (logo, colours, words to avoid).",
      "When you post a draft or a new version, tap Pre-flight check first. Add a brief on new deliverables for a better check.",
      "Drifty lists what this client is likely to say, based on the brief, the rules and what they asked for before. Fix it, or post anyway.",
      "Only your team sees the check. The client never does.",
    ],
  },
  {
    q: "Approvals and the ledger",
    steps: [
      "Only the approver you named can tap Approve on a card.",
      "Every approval is recorded with the exact copy and file. Open Approval ledger on the project to filter or export CSV.",
    ],
  },
  {
    q: "Get alerts on your phone",
    steps: [
      "Tap the bell (Alerts) at the top of Drifty or the client room, then Allow.",
      "Your team gets an alert for client feedback, approvals and change requests. Clients get one when a version is ready to review.",
      "On iPhone, first add Drifty to the Home Screen (Share → Add to Home Screen), open it from there, then tap the bell.",
      "Alerts never show message text. Tap the bell again to turn them off on that device.",
    ],
  },
  {
    q: "Client can't open their link",
    steps: [
      "Links last 30 days. In Client people, use Copy link again or New link.",
      "If they opened it while signed in as your agency account, ask them to use their own phone or a private window.",
    ],
  },
];

async function WhatsAppSupport() {
  await connection(); // read at request time: set SUPPORT_WHATSAPP in Vercel, no rebuild needed
  const digits = (process.env.SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  const href = `https://wa.me/${digits}?text=${encodeURIComponent("Hi Drifty team, I need help with: ")}`;
  return (
    <a href={href} target="_blank" rel="noopener" className={`${buttonVariants()} bg-[#1f9d55] text-white hover:bg-[#178a49]`}>
      Chat with us on WhatsApp
    </a>
  );
}

export default function HelpPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Help</h1>
        <p className="text-muted-foreground mt-1 text-sm">Short guides for the things agencies do every day in Drifty.</p>

        <div className="mt-6 divide-y rounded-lg border">
          {GUIDES.map((g, i) => (
            <details key={g.q} className="group p-4" open={i === 0}>
              <summary className="cursor-pointer list-none font-medium">
                <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                {g.q}
              </summary>
              <ol className="text-muted-foreground mt-2 ml-5 list-decimal space-y-1 text-sm leading-relaxed">
                {g.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </details>
          ))}
        </div>

        <section className="bg-secondary mt-8 rounded-lg border p-5">
          <h2 className="font-semibold">Still stuck?</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Email <SupportEmail fallback="us from inside the app" subject="Drifty help" />. We usually reply the same working day.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Suspense fallback={null}>
              <WhatsAppSupport />
            </Suspense>
            <Link href="/login?mode=signup&demo=1" className={buttonVariants({ variant: "outline" })}>
              Try the demo project
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
