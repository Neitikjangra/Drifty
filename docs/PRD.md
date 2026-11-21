# Drifty — Product Requirements Document

Build Drifty with Claude Code in rounds that each end with a working, clickable product, all Must features first, live and submitted by Nov 22, 2026 11:59 PM IST.

## 1. Product summary and launch goal

Drifty is a chat-first client room for agencies. An AI agent turns client messages and voice notes into a confirmed change list, flags drift (conflicting feedback, or versions that miss changes), and records a tamper-proof approval.

**Source of truth:** the approved SRS, [Drifty — Software Requirements Specification (MVP)](https://claude.ai/artifact/1dutQp2mKyfYUxoMpGUBFN). Requirement IDs (FR-x, AI-x, NFR-x) below refer to it.

**Build rule:** all 14 Must requirements (FR-1 to FR-14) first, in 6 rounds. Should items (FR-15 to FR-18) only after Round 6 passes. Could items (FR-19, FR-20) are dropped.

**Every round ends with something you can click.** Each round is deployed to the same live URL and closes with a hands-on check (section 5).

### What "ready to sell" means for this launch

Being honest about 2.5 days: Drifty can be **pilot-ready**, meaning real agencies use it daily with real clients. It can't be a fully self-serve paid SaaS yet.

| Ready by 22 Nov (built) | Ready by 22 Nov (human tasks) | After the competition |
| --- | --- | --- |
| Live, deployed app on your own domain | Privacy policy and terms (template + review) | Self-serve checkout and subscriptions |
| Sign-up, onboarding, all Must features | Manual pilot pricing; invoice by payment link | Integrations (Drive, Figma, Canva) |
| Landing page with pricing and "Start free" | 5 to 10 pilot agencies onboarded | Native mobile apps |
| Error handling, security basics, monitoring | Support email and WhatsApp number for pilots | Formal security review |

### Success metrics for the submission

- 100% of the Must acceptance checks pass on the live URL (SRS section 8).
- At least 5 real agencies and 10 real client stakeholders active, visible as MAU in the Nexconn Console.
- No crash or dead end in the 3-minute demo path.

## 2. Rule book compliance checklist

Every rule in the official rules PDF maps to a build item or a human task. Nothing here is optional except the traction bonus, and that bonus is worth chasing.

| Rule (official PDF) | How Drifty complies | Owner | Round |
| --- | --- | --- | --- |
| Functional app using the Nexconn Chat SDK; Chat UI counts; must show **real, measurable** SDK usage; no Chat SDK means disqualification | All rooms, cards, approvals and AI messages run through Nexconn (ChatUI Web + Chat SDK + server SDK). Every client action is a Nexconn message or message update | Claude Code | R1 onward |
| Call SDK optional | Not used (FR-20 dropped) | — | — |
| Platforms: Web, iOS, Android, Flutter only | Web app (responsive for phone browsers) | Claude Code | R0 |
| Teams of 1 to 4 | Register the team on Reskilll | Human | Now |
| AI coding tools welcome; Nexconn provides AI skills | Install the `nexconn-chat` Skill in Claude Code before R0 | Human | R0 |
| Code of conduct: no plagiarism | All code original or properly licensed; ChatUI is Apache-2.0, and `@nexconn/engine` and `@nexconn/chat` are closed-source under their own licence ([ChatUI repo](https://github.com/NexconnAI-Dev/nexconn-chatui-web)) | Claude Code + human | All |
| **Write-up PDF (required):** why you built it, problem solved, features that use the Nexconn SDK, **include your Nexconn App Key** | Write from section 8's outline; include the App Key (not the secret) | Human | Sun |
| **Demo video (required):** main features working; public link (YouTube, Vimeo, Loom or Drive) | Record the 3-minute demo path (section 8) | Human | Sun |
| **Runnable app (required):** live URL | Deployed on Vercel with your domain | Claude Code + human | R0 onward |
| **Source code (required):** public GitHub repo | Public repo; secrets only in env vars; README with setup | Claude Code + human | R0 |
| **Traction proof (bonus):** real people use the app; early users count as active users on Nexconn | Onboard pilot agencies + their clients; screenshots of Nexconn Console MAU, a user list and testimonials | Human | Sat–Sun |
| Don't post App Keys, user IDs or logs publicly; support via GitHub issues at NexconnAI-Dev/hackathon | `.env` git-ignored; strip keys from logs and screenshots in issues | Claude Code + human | All |
| Deadline Sun 22 Nov, 11:59 PM IST; submissions editable until then | Submit a first version by **Sun 6 PM IST**, then update | Human | Sun |

Judging weights (completeness & UX 50%, innovation & scenario 30%, business & growth 20%) shape the build: polish the Must path before adding anything else.

## 3. Human tasks (outside Claude Code)

Claude Code can't create accounts, hold secrets, sign up customers or record the video. These tasks block the build, so do the "Before R0" block first (about 60 to 90 minutes).

### Before Round 0 (Fri morning)

- [ ] Register the team (1 to 4 people) on Reskilll for the challenge
- [ ] Create a free Nexconn account; create an app in the Nexconn Console; copy the **App Key** and **App Secret**
- [ ] In the Nexconn Console, find where to set the **webhook / message callback URL** and whether voice-to-text and translation need switching on (fill in the URL after the first deploy)
- [ ] Create a **Gemini API key** in Google AI Studio with billing on, for **Gemini 3.8 Flash** (`gemini-3.8-flash`). It's used for AI-1 to AI-3 and for transcribing voice notes
- [ ] Create a **Supabase** project; copy the URL, anon key and service-role key; turn on email magic-link sign-in; add a custom SMTP sender (e.g. Resend), since the built-in sender is meant for testing
- [ ] Create a **public GitHub repo** `drifty` and a **Vercel** project linked to it
- [ ] Buy a **domain** (e.g. getdrifty.app) and point it at Vercel
- [ ] Install the Nexconn Skill in the repo: `npx skills add https://github.com/NexconnAI-Dev/nexconn-skills.git --skill nexconn-chat` ([NexconnAI-Dev](https://github.com/NexconnAI-Dev))
- [ ] Put all keys in `.env.local` and in Vercel environment variables; **never paste them into Claude Code chat or commits**

### During the build

- [ ] After each round, do its **Try it** check on desktop and on one real phone; reply "approved" or list bugs before the next round starts
- [ ] Prepare demo assets by Fri night: one fictional brand, 3 draft images, captions, 2 short voice notes (Hindi + English)
- [ ] Fri: message 20 to 30 agencies or freelancers you know (LinkedIn, WhatsApp, college network); aim for **5 to 10 pilots**
- [ ] Sat: onboard pilots in 15-minute calls; each invites at least 1 real client stakeholder
- [ ] Sat: publish a privacy policy and terms (generator template + your review; mention India's DPDP Act and that AI processes chat content)
- [ ] Sat: decide pilot pricing and create a payment link (Razorpay or Stripe) for agencies who want to pay after the pilot
- [ ] Set up a support email (e.g. support@yourdomain) and a WhatsApp number for pilots

### Sunday (submission)

- [ ] Collect traction proof: Nexconn Console MAU and message screenshots (hide keys and user IDs), list of pilot agencies, 2 to 3 quotes
- [ ] Record the demo video (section 8 script); upload to YouTube or Loom as public or unlisted with link access
- [ ] Write the PDF write-up (section 8 outline) **including the Nexconn App Key**
- [ ] Check the repo is public, the README works, and no secrets are in history
- [ ] Submit by **6 PM IST**, then edit until 11:59 PM IST if needed

## 4. Tech stack, repo layout, environment

One Next.js app on Vercel, Supabase for data and auth, and Nexconn for every conversation. Use one language (TypeScript), one deploy, and no extra servers.

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui | Fast to build, one repo for UI and API |
| Chat UI | `@nexconn/chatui` + `@nexconn/engine` + `@nexconn/chat` + `lit` (Node 18.12+) | Official ChatUI Web; custom message components register before `ready()` ([repo](https://github.com/NexconnAI-Dev/nexconn-chatui-web)) |
| Chat server | Nexconn Node server SDK | Create channels, issue user tokens, bot sends, stream sends, message metadata ([repo](https://github.com/NexconnAI-Dev/nexconn-server-sdk-node)) |
| Database + auth + files | Supabase (Postgres, row-level security, magic-link auth, Storage) | Auth and storage included |
| AI | **Gemini 3.8 Flash** (`gemini-3.8-flash`) through the Gemini API (`@google/genai`, or the Vercel AI SDK Google provider with `generateObject` + a Zod schema), for AI-1 to AI-3. Default thinking level is medium; use **low** for AI-1/AI-2 to keep latency down. Introductory price $0.75 / $3.75 per 1M input/output tokens until 31 Dec 2026, then $1.50 / $7.50 ([Google](https://ai.google.dev/gemini-api/docs/latest-model)) | One model and one key for text, images and audio: it covers the change list, the drift check and voice transcription |
| Speech-to-text | Nexconn built-in voice-to-text first; otherwise transcribe with Gemini 3.8 Flash, which accepts text, image, video, audio and PDF input ([model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)). No separate STT service needed | Voice notes are core (FR-7) |
| Background work | Next.js `after()` in the webhook handler, plus a `jobs` table with retry | The webhook answers fast; AI runs after |
| Hosting | Vercel + custom domain | Live URL from Round 0 |
| Monitoring | Sentry (free tier) + Vercel logs | Catch demo-breaking errors |
| Tests | Vitest (unit), Playwright (one end-to-end happy path) | Each round's check is repeatable |

### Repo layout

```
drifty/
  CLAUDE.md                  # section 9
  docs/PRD.md  docs/SRS.md   # export these docs as Markdown into the repo
  app/
    (marketing)/page.tsx     # landing + pricing
    (auth)/login  join/[token]
    app/                     # signed-in agency app
      projects/  projects/[id]/  projects/[id]/ledger/
    api/
      nexconn/token/route.ts     # issue user tokens
      nexconn/webhook/route.ts   # message events in
      projects/  deliverables/  versions/  changes/  approvals/  ai/
  components/chat/           # ChatUI host + custom cards (Lit or React wrappers)
  lib/nexconn/  lib/ai/  lib/db/  lib/auth/
  supabase/migrations/
  tests/
```

### Environment variables (`.env.example`, values only in `.env.local` and Vercel)

```
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_NEXCONN_APP_KEY=
NEXCONN_APP_SECRET=
NEXCONN_API_BASE=
NEXCONN_WEBHOOK_SECRET=        # or whatever signature scheme the Nexconn docs specify
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
AI_MODEL=gemini-3.8-flash
STT_API_KEY=                   # not needed: Gemini 3.8 Flash transcribes audio
SENTRY_DSN=
MAGIC_LINK_SIGNING_SECRET=
```

## 5. Build rounds

Seven rounds: six Must rounds, then one Should round. Each ends deployed with a **Try it** check, and the next round starts only after the check passes. Paste each round's prompt into Claude Code as-is.

&#91;embedded content: Build roadmap · Fri to Sun, 7 rounds\]

Each box is one Claude Code round. The bottom line in each day is the human work that runs in parallel.

### Round 0: Foundation and Nexconn spike (Fri, about 3 h)

**Scope:** scaffold, deploy, Nexconn connect, and the riskiest piece: a custom card whose status updates live.

**Prompt for Claude Code:**

> Read CLAUDE.md, docs/PRD.md section 4 and docs/SRS.md. Use the nexconn-chat Skill. Scaffold the Next.js + TypeScript + Tailwind + shadcn app with the repo layout in PRD section 4, and connect Supabase. Build `/api/nexconn/token` to issue a Nexconn user token for a signed-in user (server-side, using the App Secret). Build a `/spike` page that hosts Nexconn ChatUI Web for a test group channel between two test users. Register a custom message type `drifty:deliverable` with a component showing a title, image, status chip and an Approve button. Clicking Approve calls our API, which updates the message's status through Nexconn message extensions/metadata from the server, and both browsers must show the new status live. If ChatUI can't render custom interactive components, stop and report options before building anything else. Deploy to Vercel. Write a short README.

**Try it:** open `/spike` in two browsers as two users, chat, click Approve, and see the chip turn green in both within 2 seconds.

**If it fails:** ask on GitHub issues (NexconnAI-Dev/hackathon, no keys in the post). Meanwhile the fallback is Chat SDK (`@nexconn/chat`) messages rendered in our own React message list. The rule book counts Chat SDK usage as fully as ChatUI.

### Round 1: Accounts, workspace, projects, rooms (FR-1, FR-2, FR-3) (Fri, about 4 h)

> Implement FR-1 to FR-3 from docs/SRS.md with the data model in PRD section 6. Agency sign-up/login with Supabase magic link, onboarding (workspace name, your role), and a Projects list. Creating a project creates two Nexconn group channels (client room, internal room) and adds the Drifty AI bot user to both; store channel ids. Invite client people by signed magic link (`/join/[token]`, 7-day expiry, revocable) and mark one person as approver. Joined clients get a Nexconn user, enter only their project's client room, and never see the internal room. Enforce access with Supabase RLS plus server checks. Polished empty states and loading states.

**Try it:** sign up, create the project "Diwali campaign", invite your phone as approver, then chat AM ↔ client live. Check that the client can't open the internal room URL.

### Round 2: Deliverables, versions, approvals (FR-4, FR-5, FR-6, FR-10, FR-13 core) (Fri night, about 4 h)

> Implement deliverable cards per PRD section 6 schemas. The AM uploads an image (Supabase Storage) plus copy text plus a due date, which creates Deliverable + Version 1 and posts a `drifty:deliverable` custom message in the client room. Client reviewers can reply to the card; only the approver sees Approve vX / Request changes. Status flows Draft → In review → Changes requested → Approved, updated in place through message extensions. The creative uploads a new version from the internal room or the project page, which posts vN+1 and marks older cards "Superseded". Every approval writes an immutable Approval row (version, approver, timestamp, copy snapshot, asset SHA-256).

**Try it:** post v1, request changes from the phone, upload v2, approve v2, and see the card turn green for everyone. Check that the approval row exists.

### Round 3: Voice, AI change list, conflict alert (FR-7, FR-8, FR-9, FR-12) (Sat morning, about 5 h)

> Enable image and voice messages in rooms. Implement `/api/nexconn/webhook` with signature verification as per Nexconn docs. Store every client-room message (id, author, text, reply-to, voice URL, timestamp) and transcribe voice notes (Nexconn voice-to-text, otherwise Gemini 3.8 Flash audio transcription). Add a "Summarise feedback" button per deliverable (internal room + project page) that runs AI-1 (PRD section 6 prompt, JSON schema) on messages since the current version and posts a `drifty:changelist` card in the internal room. The AM can confirm, edit or reject each item; confirmed items form the creative's brief. Run AI-2 on the same input; if conflicts exist, post a `drifty:conflict` card in the client room asking the approver to choose, and record their choice as a change item. Every item links to its source message.

**Try it:** from two client accounts, send "make the logo bigger" (text) and a voice note asking for a smaller logo and a different CTA. Press Summarise: you should get a 2-item change list and a conflict card on the approver's phone.

### Round 4: Version drift check, ledger, dashboard (FR-11, FR-13 full, FR-14) (Sat afternoon, about 4 h)

> When vN+1 is uploaded and confirmed change items exist for vN, run AI-3 (copy diff plus a vision comparison of the two images) and post a `drifty:drift` card in the internal room listing each item as done / missing / reversed / needs human check. The AM can "Send to client anyway" or "Back to creative". Build the Ledger page per project (table, filters, CSV export, read-only). Build the project dashboard: deliverables by status, open change items, rounds used, waiting-on (client vs team).

**Try it:** upload a v2 that ignores the CTA change and see a drift alert naming it. Upload v3, approve, then export the ledger CSV.

### Round 5: Production hardening and launch surface (Sat night, about 4 h)

> Make it sell-ready per PRD section 7: landing page with the value proposition, a 3-step how-it-works, pricing (Free: 2 active clients; Pilot plan: contact), FAQ, privacy and terms pages (content from the team), and a "Start free" CTA. Add first-run onboarding with a seeded demo project. Audit RLS and every API route for authorisation. Add rate limits on auth, join, AI and upload routes; Sentry; friendly error states; mobile layout for the client room. Write a Playwright test for the full demo path and run it against the preview deploy.

**Try it:** a new person signs up from the landing page on a phone and completes the demo project without help. The Playwright test passes.

### Round 6: Should items, only if Round 5 is approved (Sun morning, stop at 2 PM)

Build in this order, each deployed separately so you can stop anytime:

1. **FR-17 Nudges:** if the approver hasn't seen a card (read receipts) 24 hours before its due date, the bot posts a reminder in the client room.
2. **FR-16 Approval drift:** a vague "ok" or 👍 outside a card triggers the bot to ask "Does this approve all of vX?" with Yes/No buttons.
3. **FR-15 Scope drift:** the AM sets included rounds; at the limit, warn the AM with a draft client note.
4. **FR-18 Daily digest** in the internal room.

**Code freeze: Sun 4 PM IST.** After that, only bug fixes.

## 6. Detailed specs

These are the contracts Claude Code builds against. Changing one means updating this section first.

### Data model (Postgres, all tables have `id uuid pk`, `created_at`)

```sql
workspaces(name, owner_id, plan text default 'free')
members(workspace_id, user_id, role text check (role in ('owner','am','creative')))
profiles(user_id, display_name, email, nexconn_user_id unique)
projects(workspace_id, client_name, approver_id, rounds_included int default 2,
         client_channel_id text, internal_channel_id text, archived bool default false)
project_guests(project_id, user_id, role text check (role in ('approver','reviewer')))
invites(project_id, email_or_phone, display_name, role, token_hash, expires_at, revoked_at,
        first_used_at, last_used_at, used_by, created_by)
        -- R1: display_name/used_by/created_by added; used_at renamed first_used_at,
        --     last_used_at added (links are reusable by the one invited person)
deliverables(project_id, title, due_date, status text, current_version int)
versions(deliverable_id, number int, asset_path, asset_sha256, asset_mime, copy_text,
         card_message_id text, created_by)   -- asset_mime added R2 (image vs PDF card)
messages(project_id, channel_id, nexconn_msg_id unique, author_id, kind, text,
         reply_to_msg_id, voice_url, transcript, sent_at)
change_items(version_id, text, type text, author_ids uuid[], source_msg_ids text[],
             status text, confidence real, confirmed_by)
drift_alerts(deliverable_id, version_id, kind text, detail jsonb, card_message_id,
             resolved_by, resolved_at)
approvals(version_id, approver_id, approved_at, copy_snapshot, asset_sha256)  -- insert only
jobs(kind, payload jsonb, status, attempts int, last_error)
```

**Status values.** Deliverable: `draft, in_review, changes_requested, approved`. Card (message metadata) adds `superseded` for older versions. Change item: `suggested, confirmed, rejected, done, missing, reversed, needs_check`.

### Custom Nexconn message types (content JSON)

| Type | Posted in | Content fields | Buttons (who) |
| --- | --- | --- | --- |
| `drifty:deliverable` | Client room | deliverableId, versionId, version, title, imageUrl (access-checked `/api/assets/:versionId`), copy, dueDate, status, assetKind (image/pdf, added R2) | Approve vX, Request changes (approver only) |
| `drifty:changelist` | Internal room | deliverableId, versionId, items\[{id, text, type, author, sourceMsgId, status}\] | Confirm / Edit / Reject per item; Send brief (AM) |
| `drifty:conflict` | Client room | deliverableId, optionA{text, author}, optionB{text, author} | Choose A / Choose B / Other (approver) |
| `drifty:drift` | Internal room | deliverableId, fromVersion, toVersion, results\[{itemId, verdict, note}\] | Back to creative / Send to client anyway (AM) |
| `drifty:receipt` | Client room | versionId, approver, approvedAt | None |

Status changes are written through message extensions/metadata from the server only. Clients never write status directly.

### AI prompts (all run server-side on Gemini 3.8 Flash, JSON-schema structured output)

**AI-1: Change list.**

- System: "You turn client feedback on a creative deliverable into discrete, actionable change requests. Use only what the messages say. One item per change. If a message is unclear, output it as type 'question'. Never invent changes."
- Input: deliverable title, current version copy, and the messages list (id, author name, role, text or transcript, reply-to).
- Output: `{items:[{text, type:'copy'|'visual'|'layout'|'other'|'question', source_msg_ids[], author_ids[], confidence 0-1}]}`

**AI-2: Conflicts.**

- Input: AI-1 items with authors.
- Output: `{conflicts:[{item_a, item_b, summary}]}`. It reports only real contradictions from different people.

**AI-3: Drift check.**

- Input: confirmed items, copy vN and vN+1, image vN and vN+1.
- Output: `{results:[{item_id, verdict:'done'|'missing'|'reversed'|'needs_check', note}]}`. Visual items use 'needs\_check' unless the change is clearly visible.

**Guards:** reject output that doesn't parse and retry once; drop items with confidence below 0.5 into 'question'; cap input at the last 200 messages.

### API routes

| Route | Purpose |
| --- | --- |
| `POST /api/nexconn/token` | Nexconn token for the signed-in user (creates the Nexconn user on first call) |
| `POST /api/nexconn/webhook` | Verify signature, store message, queue jobs, return 200 fast |
| `POST /api/projects`, `PATCH /api/projects/:id` | Create a project (+ 2 channels + bot), set approver and rounds |
| `POST /api/invites`, `POST /api/join/:token` | Create and accept magic-link invites |
| `POST /api/deliverables`, `POST /api/deliverables/:id/versions` | Create a deliverable or a new version (posts the card) |
| `POST /api/versions/:id/approve`, `POST /api/versions/:id/request-changes` | Approver actions (server checks role) |
| `POST /api/deliverables/:id/summarise` | Run AI-1 + AI-2 |
| `PATCH /api/changes/:id` | Confirm, edit or reject an item |
| `POST /api/conflicts/:id/resolve` | Approver's choice |
| `GET /api/projects/:id/ledger.csv` | Ledger export |

### Screens

1. Landing + pricing
2. Login / sign-up
3. Onboarding
4. Projects list
5. Project page: client room (left), internal room (tab), deliverables panel (right)
6. Deliverable detail: versions, change list, drift results
7. Ledger
8. Client join page
9. Client room (mobile-first, no navigation chrome)
10. Settings: team, invites

## 7. Production readiness

These are the minimum bars for letting a paying agency put real client work in Drifty. Claude Code checks each one in Round 5. Items marked (H) need a human decision.

| Area | Requirement |
| --- | --- |
| Secrets | App Secret, service-role key and Gemini API key are server-only; none in the client bundle or git history; `.env.example` committed with blanks |
| Auth | Supabase magic link for agency users. Client invites are personal, reusable links for one invited person: 30-day expiry, work on any device, revocable by the AM (revoking also removes room access), re-issuable ("Copy link again", "New link"). Link tokens are 256-bit HMACs of the invite id, stored only as a keyed hash. On join the client gets a secure, httpOnly, 30-day session cookie (renewed on each visit) so return visits go straight to the room |
| Authorisation | RLS on every table by workspace and project; every API route re-checks the role (approver-only actions verified server-side) |
| Tenant isolation | A user only gets Nexconn tokens and channel membership for projects they belong to; internal rooms never include guests |
| Webhook | Verify Nexconn's signature, reject replays, deduplicate on `nexconn_msg_id`, and answer within 1 second |
| Ledger integrity | `approvals` is insert-only (no update/delete grants); stores the copy snapshot and the asset SHA-256 |
| AI safety | AI never approves; never sends to clients without a person (except conflict questions); every item links to its source message; errors fall back to "Couldn't summarise, try again" |
| Rate limits | Auth, join, upload and AI routes limited per user and IP; uploads at most 20 MB, images and PDF only |
| Reliability | Failed AI and webhook jobs retry 3 times through `jobs`; Sentry alerts; a health check at `/api/health` |
| UX quality | Loading, empty and error states on every screen; works at 375 px width; Chrome and Safari tested; no console errors on the demo path |
| Privacy (H) | Privacy policy + terms published; states that chat content is processed by an AI provider; a data deletion request path (email); data hosted with Supabase/Vercel, regions noted |
| Testing | Vitest for AI parsers, permission checks and the ledger; one Playwright test for the full demo path; run before every deploy |
| Observability | Log job outcomes and AI latency (no message contents in logs) |
| Cost control | AI calls only on button press or new version (never per message); prompt size capped |

## 8. Submission kit, sales launch, risks

The submission needs four artefacts. The demo script and write-up outline below are written to score on all three judging criteria.

### Demo video script (3 minutes)

1. **0:00–0:20 Problem:** feedback scattered across WhatsApp, five revision rounds, "I never approved that."
2. **0:20–0:50** The AM creates the project and invites the client by link. On the client's phone, the room opens with no install.
3. **0:50–1:30** The AM posts v1. Two client people send conflicting text and voice feedback. Summarise produces the change list plus a conflict card, and the approver chooses.
4. **1:30–2:10** The creative uploads v2 that misses the CTA. The drift alert names the missing item. v3 is fixed.
5. **2:10–2:35** The approver taps Approve v3. The card turns green everywhere, and the ledger and CSV show the record.
6. **2:35–3:00** Traction (pilot agencies, Nexconn MAU) and the business model.

### PDF write-up outline

1. Problem and evidence: the IPA five-rounds finding and the agency quotes (from the SRS)
2. What Drifty does: the four drifts
3. **Features that use the Nexconn SDK:** group channels, custom messages, message extensions, voice messages and voice-to-text, webhooks, server-SDK bot sends, read receipts (if FR-17 ships)
4. Architecture diagram and AI design (human approval rules)
5. Traction: pilots, users, messages, quotes
6. Business model and roadmap
7. **Nexconn App Key**, live URL, video link, GitHub link

### Launch-to-sales checklist (human, Sat–Sun)

- [ ] The landing page states the price: free for 2 active clients; pilot plan by payment link
- [ ] A 1-page pitch for agencies: "Stop chasing feedback. Drifty turns client chat into a change list and catches what's missed."
- [ ] A 15-minute onboarding call script; set up each pilot's first project with them
- [ ] Ask each pilot: what they'd pay per month and what would stop them using it
- [ ] Follow up on Monday 23 Nov with a payment link for pilots who want to continue

### Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| ChatUI custom interactive cards are harder than expected | Round 0 spike decides early; fallback is a Chat SDK message list in React (still Chat SDK usage) |
| Nexconn voice-to-text not callable from the server | Transcribe with Gemini 3.8 Flash audio input (FR-7 stays Must) |
| Webhook config or signature unclear | Ask in NexconnAI-Dev/hackathon issues (replies within 12 h); meanwhile record messages client-side through the Chat SDK's message listener and post them to our API |
| AI misreads feedback | The AM confirms every item; source links; "question" type for unclear items |
| Clients won't leave WhatsApp | The AM pastes the room link into WhatsApp once; the card experience must beat a screenshot thread |
| Time overrun | Should round is optional; code freeze Sun 4 PM IST |

## 9. CLAUDE.md (paste into the repo root)

This file keeps Claude Code on track in every session. Export this PRD and the SRS as Markdown into `docs/` alongside it.

```markdown
# Drifty: rules for Claude Code

## What we're building
Drifty: chat-first client rooms for agencies. AI turns client feedback (text + voice)
into a confirmed change list, flags drift, and records approvals.
Specs: docs/PRD.md (build plan, contracts) and docs/SRS.md (requirements). PRD wins on conflict.

## Hard rules
- Nexconn Chat SDK / ChatUI is mandatory for every conversation. Never replace it with our own chat.
- Use the nexconn-chat Skill and docs.nexconn.ai for any Nexconn API. Never guess an API; if unsure, say so.
- Build only the current round from PRD section 5. Must items before Should. No Could items.
- Every round ends deployed and clickable. Finish with: what changed, how to try it, known issues.
- Secrets only in env vars. Never print, log or commit keys, user IDs or message contents.
- Server-side checks for every permission. Approver-only actions verified on the server.
- `approvals` is insert-only. Card status changes only from the server.
- AI never approves, and never messages clients except conflict questions (and FR-16/17 if built).
- AI output must match the JSON schema in PRD section 6; reject and retry once on parse failure.

## Style
- TypeScript strict, Next.js App Router, server actions or route handlers, Tailwind + shadcn/ui.
- Small files; lib/ for logic; components/chat/ for Nexconn UI.
- Clean UI: loading, empty and error states everywhere; mobile 375 px works.

## Before saying a round is done
- `pnpm lint && pnpm typecheck && pnpm test` pass; Playwright demo path passes from Round 5.
- Deployed to Vercel preview, then production.
- Update docs/CHANGELOG.md with the round number and what to try.
```

**How to run each round:** start a Claude Code session, then paste "Do Round N from docs/PRD.md section 5" followed by the round's prompt. Review the result with the Try it check, and only then move on.
