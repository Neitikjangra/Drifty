# Changelog

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
**Automated check:** `pnpm test:e2e` (against a local `pnpm start` on port 3100) runs 55
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
