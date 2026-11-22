# Changelog

## Market-ready: report, alerts, pre-flight check (2026-11-23)

- **Monthly client report:** Project → Monthly report →. Shows approvals, rounds, turnaround,
  changes captured and drifts caught for one month (India time). Save as PDF, or share a short
  summary in the client room as your own message.
- **Push notifications:** a bell in the top bar and in the client room. The team gets an alert
  for client feedback, approvals and change requests; clients get one when a version is ready or
  the team replies. Alerts never show message text. On iPhone, add Drifty to the Home Screen first.
  Opening an invite on a browser that's signed in to the agency now offers to sign out and open the
  room; clients opening the installed app go straight to their room or can paste their link.
- **Pre-flight check (AI-4):** before you post a draft or a new version, tap **Pre-flight check**.
  The AI compares the draft (image and copy) with the brief, the client's brand rules and the
  change requests they made before, and lists the feedback they're likely to give, each with its
  evidence. Team only; it never posts to the client. Add brand rules under **Brand rules & taste**
  on the project and a brief on each new deliverable.
- **All suites:** 84 unit tests; E2E Round 1: 70, Round 3: 33, Round 4: 61, all passing.

## Pre-submission audit (2026-11-22)

- **AI was down in production:** the Gemini key is on the Free Tier, and its *daily* quota was
  used up on gemini-3.8-flash, 3-flash-preview, 3.5-flash and flash-latest, so Summarise and the
  drift check failed.
  - Added `gemini-flash-lite-latest` and `gemini-3.5-flash-lite` (approved) as the first backups
    in production. Both were tested on the real demo: separate logo items for each person, the CTA
    flagged missing, the bigger logo done.
  - A model whose daily quota is used up is now skipped for 10 minutes, not 1.
  - **Round 3 is back to 34/34, with the change list in 12.9 s** (target 15 s). Round 4 is 38/38.
- **Room tabs on phones:** tapping Internal while the chat was still starting could be undone by
  the delayed first open, or fail silently and leave ChatUI's bare channel list. The room you
  pick now always wins, with retries.
- **Demo test:** the Playwright test now scrolls the chat, not the page, to reach older cards.
- **All suites:** 69 unit tests; E2E Round 1: 67, Round 2: 36, Round 3: 34, Round 4: 38, Round 5:
  28, Round 6: 22, all passing; Playwright demo path passing.

## Round 6: Should items (FR-15, FR-16, FR-17, FR-18) (2026-11-22)

**Built**
- **FR-16 approval drift:** when the approver sends a vague "ok", 👍, "looks good" or "theek hai"
  in the client room (outside a card) while a version is in review, Drifty AI posts "Does this
  approve all of vX?" quoting their words.
  - **Yes** goes through exactly the same approval path as the card's Approve button: ledger row
    with the exact copy and file hash, a green card, a receipt. **No** approves nothing.
  - Only the approver can answer, checked on the server, and only once. One open question per
    version.
  - Detection is a short-message rule (English, Hinglish, emoji) with no AI cost. "ok but…",
    questions and reviewers' messages are ignored.
- **FR-15 scope drift:** when a version reaches the client and the deliverable's revision rounds are
  at or past the rounds included, the AM gets a **Scope** card in Internal.
  - The card carries an AI-drafted client note, or a polite template if the AI is unavailable.
  - The AM can edit it and **Send to client** (posted as the AM's own message) or **Discard**.
  - One warning per round count.
- **FR-17 nudges:** every morning (09:00 IST), for cards still unapproved and due today or tomorrow,
  the bot reminds the approver by name in the client room. Once per version.
- **FR-18 daily digest:** every morning, each internal room gets what moved in the last 24 h
  (approvals, new versions, change lists, client messages), what's blocked (held for drift check,
  unsettled conflicts) and who's waiting (client vs team). Skipped when there's nothing to say;
  built from the data, with no AI cost.
- **Scheduling:** Vercel Cron calls `/api/cron/daily`, protected by `CRON_SECRET` (already set in
  Vercel production). Runs are recorded in `jobs`, so a repeat on the same day sends nothing
  twice. `?project=` limits a run to one project, so tests never touch real rooms.
- **Shared approval code:** approval logic moved into one function (`lib/deliverables/approve.ts`)
  used by the card and the check.

**Try it**
1. As the approver, reply "ok" or 👍 in the client room under a card that's in review. A "Does
   this approve all of v1?" card appears: tap **Yes**. The card turns green and the ledger has
   the row. (Needs the Nexconn webhook configured.)
2. Set **Rounds used → Change** to 1 on a project, then upload v2 with no confirmed changes. The
   Internal room gets a Scope card: edit the note and **Send to client**.
3. Give a deliverable a due date of tomorrow. The next morning's run (09:00 IST) nudges the
   approver, and Internal gets the digest.

**Checks:** lint, typecheck, 69 unit tests, E2E Round 6 (22 checks: approval check, scope, cron
auth, nudge, digest, no repeats), Rounds 1, 2 and 5 again (67, 36, 28), and a browser check of the
approval-check and scope cards and the digest/nudge messages.

**Known issues**
- Nudges use "unapproved and due soon", not Nexconn read receipts: there's no server-side
  read-receipt API we could confirm in the docs.
- The AI suites (Rounds 3, 4 and the Playwright demo) couldn't be re-run: the Gemini key's daily
  quota is used up on all three models (429). The scope note used its template fallback in testing.
- Vercel Hobby runs crons once a day; the 09:00 IST time can drift by up to an hour.

## Round 5 follow-up: change list speed (NFR-1) (2026-11-22)

- **Hedged AI calls:** if the main model hasn't answered within 4 s, the backup starts in parallel,
  the first answer wins and the other is cancelled. Before, a busy main model cost its full 10 s
  minimum deadline before the backup even started (Round 3 measured 16.0 s). Voice transcription
  hedges at 15 s, since it runs in the background.
- **Summarise round trips in parallel:** version, guests and the bot are looked up together;
  profiles and messages together; the change list card and conflict cards are posted together.
- Each model failure now logs its status code, and Summarise logs time per step (no content).
- **Measured:** 12.0–14.2 s for the change list with hedging (target 15 s). The parallel posting
  isn't measured end to end yet: the Gemini key's daily quota ran out on all three models
  (429) during testing, so the AI suites can't run until it resets or the quota is raised.
  E2E Rounds 1, 2 and 5 pass (67, 36, 28) and there are 61 unit tests, including new hedge tests.

## Round 5: production hardening and launch surface (2026-11-22)

**Built**
- **Landing page** with the value proposition, the drifts Drifty tracks, a 3-step how it works,
  **pricing** (Free: 2 active clients; Pilot: contact), FAQ and a "Start free" CTA.
  **Privacy** and **Terms** pages are honest pilot drafts with a visible "draft" notice: AI
  processing, processors and regions, cookies, deletion by email. Sign-up links to both.
- **First-run demo:** onboarding has "Add a demo project" (on by default). It seeds *Demo · Sunrise
  Cafe* with two demo client people (Priya the approver, Rahul a reviewer, each with a personal
  link), a v1 design card, and their conflicting feedback.
  - A **Demo guide** on the project page walks through all 6 steps and ticks them off from the
    real data: summarise → settle the conflict as Priya → confirm → v2 missing the CTA → v3 → approve
    and ledger.
  - The demo doesn't count towards the plan. "Try the demo project" adds one later.
- **Free plan enforced:** 2 active clients, demo excluded. Projects can be **archived** and
  **restored**, so a free agency is never stuck.
  - Archived projects stay readable for the team (history and ledger), but clients lose access
    and are removed from the client room.
  - The projects list shows plan usage and an Archived section.
- **Rate limits** shared across serverless instances in Postgres, keyed by hashed user id and IP,
  with a friendly 429 and Retry-After:
  - join: 20 per 10 min per IP
  - sign-in callback: 30 per 10 min per IP
  - uploads and voice: 60 per hour per user
  - AI (summarise, versions): 30 per hour per user
  - writes and chat tokens: per user and IP
- **Sentry** through its HTTP API, on when `SENTRY_DSN` is set. It covers route errors, render
  errors (instrumentation) and browser crashes (`/api/client-error`), and sends the error class and
  stack only, never message text.
- **Error pages:** friendly `error`, `global-error` and 404 pages.
- **Security headers:** a CSP that can't break ChatUI (no framing, plugins or foreign form
  targets), plus HSTS, nosniff, Referrer-Policy (no-referrer on invite pages) and a
  Permissions-Policy that allows the microphone only for us.
- **Reliability:** transcription and the drift check run as `jobs` with 3 attempts and are
  recorded (ids only). The drift check is safe to retry: it reuses a saved AI result and never posts
  twice.
- **Tests:** a Playwright demo-path test (`pnpm test:demo`, phone viewport), E2E Round 5 (28
  checks) and a demo seed script (`pnpm seed:demo <email>`, localhost only).
- **Docs:** `docs/SUBMISSION.md` (write-up) and `docs/DEMO_SCRIPT.md` (3-minute video).

**Fixed (found while testing)**
- **Summarise and the drift check were failing in production** with Gemini 400 "deadline too
  short". Yesterday's 8 s fail-fast timeout was below Gemini's 10 s minimum. Timeouts are now
  clamped to 10 s or more.
- **Demo feedback could be skipped:** message times came from the server clock, which can be a
  little behind the database's time for v1. They're now based on v1's database timestamp.
- **The approver's conflict choice could be overridden:** the team could Confirm the option the
  approver turned down. That now returns 409.
- **The app font never loaded:** `--font-sans` pointed at itself, so every page fell back to a
  serif font. It now uses Geist.
- **AI-1 sometimes merged opposite requests into one "question" item,** which hid the conflict and
  skipped the drift check. The prompt now keeps each person's request as its own item.
- **The demo seed failed once in testing** (database error, not reproduced in 4 retries).
  Onboarding now retries it once and logs the failing operation. If both attempts fail, the user
  gets the "Try the demo project" button.

**Try it**
1. On a phone, open https://drifty-six.vercel.app and tap **Start free**. Create an account and keep
   "Add a demo project" ticked.
2. Follow the **Demo guide**. For step 2, open Priya's link in a private window or on a second
   phone.
3. Try a third real client on the Free plan: you're asked to archive one or ask about the Pilot.

**Checks:** lint, typecheck, 57 unit tests, E2E Rounds 1-5 (67 + 36 + 33/34 + 38 + 28; the Round 3
miss is the 15 s target, 16.0 s on the slower backup model), and the Playwright demo path on a
phone-sized screen, which passed on the final build (2.8 min, real Gemini). Of the last three
runs, two passed and one hit the demo-seed error now retried; earlier runs surfaced the fixes above. Landing checked at 375 px with no
horizontal scroll.

**Known issues**
- Safari hasn't been tested (no Safari here). The client room uses ChatUI, whose docs list portrait
  mobile browsers as unsupported; it works in Chrome at 375 px. A real-phone test is still a human
  task.
- The Playwright test creates an agency account, so it runs against a local server, not production.

## Round 4: drift check, ledger, dashboard (FR-11, FR-13 full, FR-14) (2026-11-22)

**Built**
- FR-11 **version drift check:** when the team uploads vN+1 and confirmed changes exist, the new
  version is **held**. It doesn't go to the client room, and clients can't open its file.
  - AI-3 compares the copy word for word, plus both images (PNG/JPEG/WebP/PDF) by vision, against
    the confirmed change list. It checks against the last version the client saw, plus anything an
    earlier check left missing or reversed.
  - A `drifty:drift` card in the **Internal** room marks each change **Done / Missing / Reversed /
    Check by eye**, with a short note. The change list card's items update to match.
  - The AM chooses **Send to client** (labelled "Send to client anyway" if anything isn't done) or
    **Back to creative**, which posts the gaps for the creative. Each check can be decided only
    once, and only by an owner or AM, checked on the server.
  - Uploading again re-checks everything. If the AI can't run, every item becomes "Check by eye":
    nothing reaches the client unchecked.
  - The same status and both buttons also appear on the deliverable in the project page.
- FR-13 **approval ledger:** **Approval ledger** is linked from the project dashboard. It's a
  read-only table (cards on phones) with search plus filters for deliverable, approver and dates
  (India time). **Export CSV** downloads exactly what's filtered: UTF-8 with BOM for Hindi in
  Excel, IST + UTC times, approved copy, asset SHA-256, ids, and protection against spreadsheet
  formulas. Agency members only.
- FR-14 **project dashboard** at the top of every project: deliverables by status, open change
  items, waiting on client vs team, revision rounds used against **rounds included** (editable by
  the owner/AM), and a by-deliverable breakdown.

**Try it**
1. On a project with a v1 card, have the client ask for two copy changes (e.g. CTA "Buy now" →
   "Shop the sale", and add "Free delivery"). Press **Summarise feedback** and confirm both.
2. **Upload v2** that only adds "Free delivery". The deliverable shows **Held for check**, and in
   **Internal** a drift card lists the CTA as **Missing**. The client room shows nothing new.
3. Press **Back to creative**. Then upload v3 with both changes: the new card shows both **Done**.
   Press **Send v3 to client**.
4. The approver approves v3. Open **Approval ledger → Export CSV**.

**Checks:** lint, typecheck, 55 unit tests, E2E Round 1 (67), Round 2 (36), Round 4 (38, real
Gemini + Nexconn), Round 3 (32 of 33: only the 15 s speed target missed, see below), and a
browser check at phone width of the dashboard, both drift cards and the ledger (filters, no
console errors).

**Known issues**
- The Gemini key is still out of quota on gemini-3.8-flash and gemini-3-flash-preview, so AI runs
  on the slow backup gemini-3.5-flash: about 20–45 s per change list and about 20–25 s per drift
  check. Summarise now fits AI-1 and AI-2 into its 60 s limit; if AI-2 runs out of time, the team
  is told the conflict check didn't run.
- GIF drafts and files over 7 MB are compared by copy only; visual items become "Check by eye".

## Round 3: voice, AI change list, conflict alert (FR-7, FR-8, FR-9, FR-12) (2026-11-21)

**Built**
- FR-7 voice notes: a **mic button** in the room toolbar opens a recorder (up to 60 s, listen back,
  re-record, send). ChatUI for Web has no recorder, so the note goes to a private `voice` bucket via
  `/api/voice` and is posted to the room as a standard Nexconn HD voice message from the sender.
  Playback goes through an access-checked `/api/voice/:id`. Gemini transcribes it (Hindi, English
  or both) in the background.
- Message store: `POST /api/nexconn/webhook` verifies the Nexconn signature and App Key, rejects
  stale timestamps (replays), ignores duplicates, and stores every room message (text, reply, voice,
  image, file, cards) in `messages`.
- FR-8 **Summarise feedback** (deliverables panel, owner/AM): AI-1 turns the client messages since
  the current version into a change list. Each item links to its source message, and items with
  no real source are dropped. Low-confidence items become questions. A `drifty:changelist` card is
  posted in the internal room.
- FR-9: on the card the AM can **Confirm, Edit or Reject** each item. The status updates live for
  the whole team, written by the server only. **Send brief** posts the confirmed items for the
  creative.
- FR-12: AI-2 finds real contradictions between different people. For each one, a
  `drifty:conflict` card in the client room asks the approver to **choose A or B**. The choice is
  recorded: that item is confirmed, the other rejected, and it can't be changed twice.
- AI guards: JSON-schema output validated with Zod and retried once; capped at the last 200 messages;
  only the AI's suggestions are posted, and it never confirms or approves anything.
- Migrations 0004 (messages, change_lists, change_items, drift_alerts, jobs, voice bucket; RLS on
  all) and 0005 (item position).

**Try it**
1. Configure the Nexconn webhook first (human task below), or the change list will be empty.
2. On a project with a v1 deliverable, open the client invite links in two browsers or phones
   (one approver, one reviewer).
3. Approver types "Please make the logo bigger". Reviewer taps the mic, says "make the logo smaller
   and change the CTA to Shop now", and sends it.
4. As the AM, press **Summarise feedback** on the deliverable. In the **Internal** tab you get a change
   list card. In the client room, the approver gets a conflict card.
5. Approver taps option A. In Internal, edit or reject items, then press **Send brief**.

**Checks:** lint, typecheck, 40 unit tests, E2E Round 1 (67), Round 2 (36), Round 3 (34, real
Gemini and Nexconn), and a browser check of both cards.

**Known issues**
- **Gemini quota:** after a day of testing, the API key hit `429 RESOURCE_EXHAUSTED` on
  gemini-3.8-flash and gemini-3-flash-preview. Only gemini-3.5-flash still answers, at about 35 s per
  change list (the target is 15 s). Production now sets
  `AI_FALLBACK_MODEL=gemini-3-flash-preview,gemini-3.5-flash`: the main model is tried first (8 s
  limit when a backup exists), then each backup in order. Raising the Gemini quota (billing) brings
  back the fast path.
- When the quota is used up, Summarise now says so ("usage limit is used up") instead of "busy".
- If the conflict check can't run, the team is told, both in the Internal room and under the
  button. It is never silently treated as "no conflicts".
- Nexconn's own voice-to-text isn't used (not available for Web); Gemini transcribes instead.

## Auth update: email + password (2026-11-21)

- **Email switched off for now (EMAIL_ENABLED flag):** while email is off, "Email me a code instead" is
  hidden and "Forgot password?" shows "Contact support… to reset your password" (address from
  SUPPORT_EMAIL). Set EMAIL_ENABLED=true in Vercel to bring both back (no code change).
- **Owner reset tool:** `pnpm reset-link <email>` prints a one-time link (no email sent) that opens
  "Choose a new password". Tested: unknown email refused, link works once, new password signs in.

- Agency sign-up and sign-in now use **email + password**. New accounts are signed in immediately
  (Supabase "Confirm email" is off), then go to onboarding.
- Secondary options: **Email me a code instead** and **Forgot password?** (reset link → choose a new
  password at `/auth/reset`). Both need working email (SMTP).
- Clear messages for wrong password, existing account, short password, and email-service failure.
- Sign-out and sign-in callback redirects are now relative, so they always stay on the host you used.
- Tested locally with new non-owner addresses: sign up → onboarding → projects, sign out, password
  sign-in, wrong password, duplicate sign-up. Code and reset emails still fail at the SMTP step
  ("Error sending … email" from Supabase).

## Round 2: deliverables, versions, approvals (FR-4, FR-5, FR-6, FR-10, FR-13 core) (2026-11-21)

**Built**
- FR-4: on the project page, **Deliverables → New deliverable**: title, draft file (image or PDF,
  up to 20 MB), caption, due date. The file goes straight from the browser to a private
  Supabase bucket via a one-time signed slot. The server re-checks type (magic bytes), size and
  project, stores the SHA-256, creates Deliverable + v1, and Drifty AI posts a
  `drifty:deliverable` card in the client room. Images are served via the access-checked
  `/api/assets/:versionId` (short-lived signed URL).
- FR-5: only the project's approver sees **Approve vN** and **Request changes** (optional note,
  posted in the room as the approver's own message). Everyone can reply in the chat. The
  server re-checks that the caller is the named approver.
- FR-6: status flows In review → Changes requested → Approved, updated in place for everyone
  through Nexconn message metadata written by the server only.
- FR-10: **Upload vN+1** (owner, AM or creative) posts a new card and marks the old card
  **Superseded**. Approving an old version is refused.
- FR-13 core: every approval writes an `approvals` row (version, approver, time, exact copy
  snapshot, asset SHA-256). The table is insert-only: privileges are revoked and a trigger
  blocks update/delete/truncate, even for the service role. A `drifty:receipt` card is posted.
- Migration 0003 (deliverables, versions, approvals, private `deliverables` bucket).

**Try it**
1. Project page → **Deliverables → New deliverable** → title "Diwali post 1", pick an image,
   add a caption → **Post to client room**.
2. On the approver's phone the card appears with **Approve v1** / **Request changes**. Tap
   **Request changes**, type "make the logo bigger" → **Send**. Both screens show
   "Changes requested", and the note appears in the chat.
3. Laptop → **Upload v2** with a new image → the old card turns "Superseded", and a v2 card
   appears.
4. Phone → **Approve v2** → the card turns green ("Approved by …") on both screens, plus a
   receipt. The project page shows "Approved v2 by … ".

**Verified locally:** 36 Round 2 E2E checks (uploads, limits, fake-file rejection, private
bucket, approver-only actions, supersede, approval row contents, ledger insert-only) and all
67 Round 1 checks pass. Two-browser UI run at 375 px: v1 card with image, request changes,
v2 supersedes v1 live, approve v2 turns both screens green within 0.1 s of each other.

**Known issues:** an action takes ~3 s from tap to green on a local server (DB round trips
from this machine; lookups are now parallel; production is likely faster). No team invites
yet, so "creative" uploads can only be tested by owner/AM. Video links (FR-4 mentions them)
aren't supported; images and PDF only.

## Round 1: accounts, workspace, projects, rooms (FR-1, FR-2, FR-3) (2026-11-20)

**Built**
- FR-1: magic-link sign-in (`/login`, `/auth/callback`), onboarding (your name + workspace),
  owner membership, projects list with empty state.
- FR-2: "Create project" makes two Nexconn group channels (client room + internal room) with
  the Drifty AI bot as owner and a welcome message in each; channel ids stored on the project.
- FR-3: AM creates single-use invite links (7-day expiry, revocable, stored as a keyed hash)
  with role approver or reviewer; `/join/[token]` → client picks a name, gets a Nexconn user and
  joins **only** the client room; `/room/[projectId]` is the client's mobile-first room.
  One approver per project; "Make approver" switches it.
- Access control: RLS on all six tables (read-only for workspace members, no client writes);
  every route re-checks role/membership; clients get a signed httpOnly cookie, never the
  internal room. `proxy.ts` refreshes Supabase sessions and gates `/app`.
- Removed the Round 0 `/spike` page and routes.
- Migrations in `supabase/migrations/`, applied with `pnpm db:migrate`.
- Tests: 19 (tokens, guest cookie, permissions, room ids, signing, cards).

**Try it**
1. Open the live URL → **Start free** → enter your email → open the link in the email.
2. Enter your name and agency name → create the project **Diwali campaign**.
3. In **Invite a client**, add yourself (phone) as **Approver** → **Create invite link** → send
   the link to your phone (WhatsApp).
4. On the phone, open the link → **Join the room**. Chat AM ↔ client live in the Client room.
5. On the phone, open `<live URL>/app/projects/<id>` (the AM's URL): you're sent to sign-in,
   and the client never sees the Internal room.

**Verified locally:** sign-in → onboarding → project with two rooms → invite → join on a
375 px view → live chat both ways; client blocked from internal room, agency pages and
owner/AM APIs; RLS blocks anon and all direct writes; used invite link shows "already used".

**Bug fixes after review (2026-11-20):** sign-in links that Supabase sends to `/?code=` (Site
URL fallback) now reach `/auth/callback`; clear messages for each sign-in email error (hourly
email limit, address not allowed, link opened in another browser); anonymous calls to project
and invite routes now get 401 instead of 404.
**Bug fixes from the real test (Rajarshi, 2026-11-20):**
- Bug 1, "invite already used": client links are now personal and reusable for 30 days on
  any device. Reopening greets "Welcome back" and goes straight to the room. The AM can
  "Copy link again", "Remove" (link off + room access removed), or make a "New link" for
  the same person. Cancelled or expired links show "Ask your agency for a new link". The
  30-day client cookie renews on every visit. Migration 0002: `used_at` → `first_used_at`,
  plus `last_used_at`.
- Bug 2, "new messages don't show": Nexconn confirmed Rajarshi is in the FIFA Campaign client
  room (not the internal room), so membership wasn't it. Added connection handling:
  status listener before connect; fresh token + reconnect on 31004; "open on another
  device" banner with **Use here** on 31010; backoff retry on other disconnects; on
  resume/online the app reconnects, and after >30 s asleep it forces a fresh connection.
  Room header shows "Connecting… / Reconnecting… / You're offline". Room names are pushed
  to ChatUI before opening (no raw channel id on new devices).
- Measured locally (AM tab ↔ client tab at 375 px): 3 messages arrived in 1.41 s, 1.04 s and
  0.66 s; after 65 s in the background 0.62 s; second tab of the same client 0.52 s;
  Drifty AI bot message 0.91 s; after a forced reconnect 0.57 s.

**Automated check:** `pnpm test:e2e` (against a local `pnpm start` on port 3100) runs 67
end-to-end checks of every Round 1 route and permission rule and cleans up its test data.

**Known issues:** clients don't see messages sent before they joined (Nexconn group history
for new members); a client who clears cookies needs a new invite link; team invites (AM,
creative) aren't built yet; onboarding doesn't ask for a job title (everyone who signs up is the
owner of a new workspace).

## Round 0: foundation + Nexconn spike (deployed 2026-11-20)

Live: https://drifty-six.vercel.app (spike: https://drifty-six.vercel.app/spike)

**Built**
- Next.js 16 + TypeScript strict + Tailwind 4 + shadcn/ui scaffold, PRD section 4 layout.
- Supabase server/browser clients (`lib/db/`).
- Nexconn Platform Chat API client with request signing and backup-domain failover (`lib/nexconn/`).
- `POST /api/nexconn/token`: Nexconn token for the signed-in Supabase user.
- `GET /api/health`.
- `/spike`: ChatUI Web in a test group channel; `drifty:deliverable` custom card with status chip
  and Approve button; Approve → server sets message metadata → card updates live for everyone.
- Unit tests for signing, IDs and card status.

**Try it**
1. Open https://drifty-six.vercel.app/spike in two browsers (or a laptop and a phone).
2. Join as Alice in one and Bob in the other.
3. Press **Post test card**, then **Approve v1** in either browser.
4. The chip turns green in both within 2 seconds.

**Verified locally (2026-11-20):** Approve in one browser turns the chip green in both within
2 s; text chat works both ways; at 375 px ChatUI shows a single-pane room view.

**Fixed during the spike:** Lit dev/prod mismatch crash in `pnpm dev`; card status reverting
to the stale value; Approve clicks being lost when ChatUI re-rendered on hover; room not
opening on its own.

**Verified on production:** same Approve test passes on https://drifty-six.vercel.app/spike.

**Known issues:** Nexconn SDK's own log upload (logcollection.ronghub.com) is CORS-blocked and
shows console errors; an open room doesn't always auto-scroll to a new message; `/spike` is
public while `SPIKE_ENABLED=1` (test users only; removed in Round 1); not yet tried on a real phone.
