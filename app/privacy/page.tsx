import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { SupportEmail } from "@/components/marketing/support";

export const metadata: Metadata = { title: "Privacy · Drifty" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="22 November 2026">
      <p>
        Drifty is a client room for agencies. This policy explains what we store, why, who processes it for us, and how to have it
        deleted. &ldquo;Agency&rdquo; means the business that uses Drifty; &ldquo;client people&rdquo; are the people the agency invites.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>Agency accounts: name, email address, password (stored hashed by our auth provider), workspace and role.</li>
        <li>Client people: the name and email or phone number the agency enters when inviting them. Clients don&apos;t create accounts.</li>
        <li>Room content: messages, voice notes and their transcripts, uploaded drafts, captions, change lists and drift checks.</li>
        <li>Approvals: who approved which version and when, the exact copy, and a fingerprint (SHA-256) of the approved file.</li>
        <li>Technical data: security logs and rate-limit counters. IP addresses are only kept as one-way hashes.</li>
      </ul>

      <h2>Why we use it</h2>
      <p>
        To run the rooms, produce change lists and drift checks when a team member asks, keep an approval record the agency can rely on,
        keep the service secure, and fix problems. We don&apos;t sell personal data or use it for advertising.
      </p>

      <h2>AI processing</h2>
      <p>
        When a team member presses <b>Summarise feedback</b>, uploads a new version for a drift check, or a voice note is sent, the
        relevant messages, transcripts, captions and draft images are sent to Google&apos;s Gemini API to produce the result. This
        happens only on those actions, never for every message. The AI only suggests: people confirm every change and every approval.
      </p>

      <h2>Who processes data for us</h2>
      <ul>
        <li>Nexconn: chat messages, voice notes and room membership (Singapore data center).</li>
        <li>Supabase: accounts, database and file storage.</li>
        <li>Vercel: hosting of the Drifty app.</li>
        <li>Google (Gemini API): AI change lists, conflict checks, drift checks and voice transcription.</li>
        <li>Sentry (if enabled): error reports. These contain error types and code locations, never message text.</li>
      </ul>
      <p>
        Data may be processed outside India by these providers. Contact us if you need the hosting regions for your contract.
      </p>

      <h2>Cookies</h2>
      <p>
        We only use cookies needed to keep you signed in: the agency sign-in session, and for client people a secure, httpOnly cookie
        that lasts 30 days and renews on each visit. No advertising or tracking cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        For as long as the agency&apos;s workspace exists. Approval records can&apos;t be edited, so that they stay trustworthy.
        They are deleted with the workspace. Client links expire after 30 days and can be cancelled by the agency at any time.
      </p>

      <h2>Your choices and deletion requests</h2>
      <p>
        Agencies and client people can ask for a copy of their data, a correction, or deletion by emailing{" "}
        <SupportEmail fallback="the Drifty team (address shown in the app)" subject="Drifty data request" />. Client people can also ask
        the agency that invited them. We reply within 30 days.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we&apos;ll tell agency owners by email or in the app before it takes effect.</p>
    </LegalPage>
  );
}
