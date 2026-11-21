# Drifty build progress

Resume: read CLAUDE.md, docs/PRD.md, docs/SRS.md, this file and docs/CHANGELOG.md,
then continue from the first unchecked item. Rules are in docs/MASTER_PROMPT.md.

## Current status
- Round: **Round 3 built, awaiting "approved"** (human tasks: Nexconn webhook URL, Gemini quota/billing, SMTP, real-phone test). Prod AI_FALLBACK_MODEL=gemini-3-flash-preview,gemini-3.5-flash (approved 2026-11-22).
- Vercel project: `neitik-jangids-projects/drifty`, production alias drifty-six.vercel.app.
  Env vars are set for **production only**. `.env.local` values in quotes must be added unquoted.
- Last updated: 2026-11-21

## Section 0: setup
- [x] Read CLAUDE.md, PRD, SRS, MASTER_PROMPT
- [x] nexconn-chat Skill installed (.agents/skills, copied to .claude/skills)
- [x] Environment checked: Node 22.16.0, pnpm 12.21.0, git 2.56.0, Vercel CLI 66.5.0 (login not yet checked)
- [ ] `.env.local` filled: file exists; set so far: AI_MODEL, NEXT_PUBLIC_APP_URL (localhost), MAGIC_LINK_SIGNING_SECRET. Missing: Nexconn x4, Supabase x3, GEMINI_API_KEY, SENTRY_DSN
- [x] Renamed `env.example` to `.env.example`
- [ ] Project folder is a git repo linked to the public GitHub repo `drifty`
- [ ] Vercel project linked (`vercel link`)

## Round 0: foundation + Nexconn spike
- [x] Next.js 16 + TS strict + Tailwind 4 + shadcn scaffold, PRD section 4 layout
- [x] Supabase helpers (`lib/db/supabase-server.ts`, `supabase-browser.ts`). Not tested live: no keys
- [x] `POST /api/nexconn/token` (server-side, App Secret). Not tested live: no keys
- [x] `/spike` page + `/api/spike/{session,card,approve}` (gated by `SPIKE_ENABLED=1`)
- [x] `drifty:deliverable` card element (`components/chat/deliverable-card-element.ts`)
- [x] **Verified live:** Approve → server metadata → both browsers ≤2 s (event arrived in ~0.5 s)
- [x] 375 px emulation: ChatUI switches to single-pane view with back arrow; card + chat usable
- [ ] **Verify on a real phone** (ChatUI docs say portrait mobile isn't a supported target)
- [x] `/api/health`
- [x] README (setup, env var names)
- [x] lint / typecheck / test (10) / build pass locally
- [x] git init + first commit (main)
- [x] pushed to GitHub: https://github.com/Neitikjangra/drifty (main)
- [x] `vercel --prod` + env vars in Vercel → https://drifty-six.vercel.app, spike verified live
- [x] CHANGELOG started
- [ ] Report + wait for "approved"

## Round 1: FR-1, FR-2, FR-3
- [x] Migration 0001 (6 tables + RLS) applied via `pnpm db:migrate` (SUPABASE_DB_URL in .env.local)
- [x] Magic-link sign-up/login, onboarding (name + workspace; creator = owner), projects list
- [x] Project creation → 2 Nexconn group channels + AI bot; channel ids stored
- [x] Client invites `/join/[token]` (7-day, single-use, revocable, keyed hash), approver role
- [x] Guest identity = signed httpOnly cookie (`drifty_guest`), no Supabase account
- [x] RLS + server checks; client can't reach the internal room (verified)
- [x] lint / typecheck / 19 tests / build
- [x] Committed + pushed (0956dfe), deployed to https://drifty-six.vercel.app, prod smoke test OK
- [ ] Supabase Auth URL config (human) + user's Try-it check → "approved"

**Round 1 lessons:** Next 16 cache components need `connection()` before Supabase calls and each
page's data inside its own `<Suspense>`; ChatUI hooks get called with "" ids (filter them);
ChatUI shows group-member nicknames (that's how the bot gets "Drifty AI"); React dev double
effects need the shared chat instance ref-counted (`startChat`/`releaseChat`).
Local testing: `node scripts/dev-login-link.mjs am.test@drifty.test` prints a localhost
sign-in link for a test agency user (no email sent).

## Round 2: FR-4, FR-5, FR-6, FR-10, FR-13 core
- [x] Migration 0003: deliverables, versions, approvals (insert-only: revoked privileges + trigger), private bucket
- [x] Direct browser → Storage uploads (signed slot), server re-checks magic bytes/size/project, SHA-256
- [x] Deliverable + v1 card in client room; access-checked /api/assets/:versionId
- [x] Approve / Request changes (approver only, server-verified); status via message metadata
- [x] New version (owner/AM/creative) posts vN+1, old card Superseded
- [x] Approval row (copy snapshot, SHA-256) + drifty:receipt card
- [x] 31 unit tests, E2E 67 + 36 (pnpm test:e2e against local :3100), two-browser UI run
- [x] Deployed to https://drifty-six.vercel.app + pushed; prod smoke OK
- [ ] User Try-it check → "approved"

## Round 3: FR-7, FR-8, FR-9, FR-12
- [x] Image + voice messages (own recorder: ChatUI Web has none); webhook with signature verification; message store
- [x] Voice transcription (Gemini; Nexconn STT not available on Web)
- [x] AI-1 change list card; AM confirm/edit/reject; Send brief
- [x] AI-2 conflict card for approver; choice recorded
- [x] Checks (40 unit, E2E 67+36+34), changelog, PRD section 6 updated
- [ ] Deployed + webhook configured in Nexconn Console (human) + user Try-it → "approved"

**Round 3 lessons:** @google/genai must use `apiVersion: "v1beta"` (v1 404s on preview models and
JSON-schema output); its internal retries hide overload for minutes, so retries are ours (1 attempt,
25 s timeout, 60 s circuit breaker, optional AI_FALLBACK_MODEL).

## Round 4: FR-11, FR-13 full, FR-14
- [ ] AI-3 drift check card on new version; AM actions
- [ ] Ledger page + CSV export
- [ ] Project dashboard
- [ ] Checks, deploy, changelog, report

## Round 5: production hardening + launch surface
- [ ] Landing, pricing, FAQ, privacy/terms (legal text from team)
- [ ] Onboarding with seeded demo project
- [ ] RLS/route audit, rate limits, Sentry, error states, mobile client room
- [ ] Playwright demo-path test vs production
- [ ] SUBMISSION.md, DEMO_SCRIPT.md, seed script
- [ ] Checks, deploy, changelog, report

## Round 6: Should items (only if approved)
- [ ] FR-17 nudges
- [ ] FR-16 approval drift
- [ ] FR-15 scope drift
- [ ] FR-18 daily digest

## Notes / decisions
- AI model: Gemini 3.8 Flash (`gemini-3.8-flash`); STT_API_KEY not needed.

### Nexconn decision record (from docs.nexconn.ai + installed SDK types, 2026-11-20)
- **Integration layer: Layer 2, ChatUI extension.** Web group channels are covered by ChatUI
  (`@nexconn/chatui` 26.5.0 Apache-2.0, `@nexconn/chat` + `@nexconn/engine` 26.5.1 own licence).
  Cards are registered with `app.registerCustomMessages([...])` before `ready()`; ChatUI renders
  `nc-c-<tagName>` and sets `.message` (Chat SDK `Message`: `messageId`, `content`, `metadata: Map`).
- **Live status:** server calls `POST /v4/channel-type/message/metadata/set` (needs the card sent
  with `hasMetadata: true`, group = channelType 3). Clients get
  `MessageHandler.onMessageMetadataUpdated({messageId, channelIdentifier, metadata})` via
  `NCEngine.addMessageHandler`. The card element subscribes and re-renders its chip itself.
  Use `isEchoToSender: 1` when the operator also needs the echo.
- **Server side:** no `@nexconn/*` Node server SDK exists on npm, so we call the Platform Chat
  REST API from `lib/nexconn/` with headers App-Key, Nonce, Timestamp,
  Signature = sha1(AppSecret+Nonce+Timestamp) hex. Base URL per data center
  (Singapore `api.sg-light-api.com`, backup `api-b.`). Client must set the matching `areaCode`.
- Endpoints confirmed: token `POST /v4/auth/access-token/issue {userId,name,avatarUrl?}`;
  group create `POST /v4/group-channel/create {channelId,name,owner,userIds≤30}`;
  join `POST /v4/group-channel/join {channelId,userIds≤100}`; group send (custom type ≤32 chars,
  not `RC:`, content ≤10 KB, `hasMetadata`/`metadata`).
- **Webhooks:** signed with the **App Secret** (same sha1 formula, headers AppKey/Nonce/Timestamp/
  Signature); 5 s timeout, 2 retries. `NEXCONN_WEBHOOK_SECRET` is not needed. Signature doesn't
  cover the body → reject stale timestamps + dedupe on message id.
- **Spike lessons (keep for every card type):**
  1. ChatUI bundles Lit internals compiled for Lit's *production* build; `next dev` loads Lit's
     development build → "_$initialize is not a function". `next.config.ts` aliases Lit to its
     production files in dev.
  2. ChatUI re-sets `.message` with its cached model (stale metadata) and detaches/re-attaches
     bubbles on hover. Cards must (a) merge a live-metadata cache keyed by message id and
     (b) only rebuild their DOM when the visible state changes, or clicks get swallowed.
  3. Open the room ~0.8 s after connect (timers, not rAF: rAF never fires in background tabs).
  4. Nexconn SDK's own log upload to logcollection.ronghub.com is CORS-blocked on localhost
     (console errors not from our code). Re-check on the production domain in Round 5.
- **Risk: ChatUI docs say portrait mobile browsers are "not a supported target".** This conflicts
  with the 375 px client room (NFR-3/6). Round 0 spike must test it on a phone; fallback is the
  PRD's Chat SDK + own React list for the mobile client room.
