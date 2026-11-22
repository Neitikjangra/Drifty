import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { SupportEmail } from "@/components/marketing/support";

export const metadata: Metadata = { title: "Terms · Drifty" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="22 November 2026">
      <p>These terms cover your agency&apos;s use of Drifty. By creating a workspace you agree to them on behalf of your agency.</p>

      <h2>The service</h2>
      <p>
        Drifty provides client rooms, AI-suggested change lists, drift checks and an approval ledger. During the pilot we may change
        features, and we&apos;ll tell you before removing anything you rely on.
      </p>

      <h2>Your content and your clients</h2>
      <ul>
        <li>You own the content you and your clients put into Drifty. You give us permission to store and process it only to run the service.</li>
        <li>You&apos;re responsible for having the right to share drafts and client information with us, and for inviting only people who should see a room.</li>
        <li>Keep invite links private: anyone with a personal link can open that client room until you cancel it or it expires.</li>
      </ul>

      <h2>AI suggestions</h2>
      <p>
        Change lists, conflict checks, drift checks and transcripts are produced by AI and can be wrong or incomplete. Your team confirms
        every change and decides what reaches the client. Approvals are only ever made by the person you named as approver.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t use Drifty for unlawful content, to send spam, to attack or overload the service, or to get around limits or other
        people&apos;s access. We may suspend accounts that do, and we&apos;ll tell you why.
      </p>

      <h2>Plans</h2>
      <p>
        The Free plan includes 2 active clients; demo projects and archived projects don&apos;t count. Pilot plans are agreed with you
        directly. Ask <SupportEmail fallback="the Drifty team" subject="Drifty Pilot plan" />.
      </p>

      <h2>Availability and liability</h2>
      <p>
        We work to keep Drifty available and your data safe, but the pilot service is provided as is. To the extent the law allows,
        we&apos;re not liable for indirect losses, and our total liability is limited to what you paid us in the previous 12 months.
      </p>

      <h2>Ending</h2>
      <p>
        You can stop using Drifty at any time and ask us to delete your workspace. We may end the service with 30 days&apos; notice,
        and you can export your approval ledger as CSV before then.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <SupportEmail fallback="contact the Drifty team" subject="Drifty terms" />.
      </p>
    </LegalPage>
  );
}
