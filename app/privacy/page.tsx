import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { SupportEmail } from "@/components/marketing/support";

export const metadata: Metadata = { title: "Privacy · Drifty" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="23 November 2026">
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

      <h2>India: Digital Personal Data Protection Act, 2023 (DPDP Act)</h2>
      <ul>
        <li>
          <b>Roles.</b> For agency accounts, Drifty decides why and how that data is used (we act as the Data Fiduciary). For the
          client people an agency invites, and the content of client rooms, the agency decides what is shared; Drifty processes that
          data on the agency&apos;s behalf (as a Data Processor), only to run the service.
        </li>
        <li>
          <b>Purpose and consent.</b> We use personal data only for the purposes in this policy. Agencies are responsible for having
          a lawful basis (such as consent) to invite their client people and share their content in Drifty.
        </li>
        <li>
          <b>Your rights.</b> You can ask for a summary of the personal data we hold about you, its correction or completion, and
          its erasure, and you can withdraw consent. You can also nominate someone to exercise these rights for you.
        </li>
        <li>
          <b>Security and breaches.</b> We protect data with access controls, encryption in transit and private storage. If a personal
          data breach happens, we will inform affected agencies and people, and the Data Protection Board of India, as the Act requires.
        </li>
        <li>
          <b>Grievances.</b> Contact our grievance contact at{" "}
          <SupportEmail fallback="the Drifty team (address shown in the app)" subject="Drifty grievance (DPDP)" />. We acknowledge
          within 7 days and resolve within 30 days. If you are not satisfied, you may approach the Data Protection Board of India.
        </li>
      </ul>

      <h2>How to delete your data</h2>
      <ol className="ml-5 list-decimal space-y-1">
        <li>
          Email <SupportEmail fallback="the Drifty team (address shown in the app)" subject="Drifty data deletion request" /> from the
          address on your account, with your workspace name (agencies) or the project you were invited to (client people).
        </li>
        <li>We confirm the request is yours (we may ask the workspace owner to confirm for a whole workspace).</li>
        <li>
          We delete the data within 30 days: for a workspace, its projects, rooms, messages, files, change lists and approval records;
          for a client person, their profile and access. Messages they sent remain part of the agency&apos;s project record unless
          the agency asks us to remove them.
        </li>
        <li>We email you when it&apos;s done. Backups roll over and are cleared within a further 30 days.</li>
      </ol>
      <p>
        You can also ask for a copy or a correction the same way. Client people can ask the agency that invited them, and the agency
        can remove them from a project at any time.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we&apos;ll tell agency owners by email or in the app before it takes effect.</p>
    </LegalPage>
  );
}
