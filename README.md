# Drifty

Chat-first client rooms for agencies. Clients talk naturally (text or voice notes, in English, Hindi or
Hinglish). Drifty's AI turns that into a confirmed English change list, flags drift (conflicting
feedback, versions that miss a change) and records a tamper-proof approval.

**Live:** https://drifty-six.vercel.app · Built for the Nexconn Build Challenge 2026.

## Nexconn features used

| Feature | Where |
| --- | --- |
| ChatUI for Web (`@nexconn/chatui`) | Every room in the app (`components/chat/`) |
| Chat SDK (`@nexconn/chat`, `@nexconn/engine`) | Connection, live message-metadata events |
| Group channels | Client room and internal room per project |
| Custom messages | 7 cards: deliverable, change list, conflict, drift check, receipt, approval check, scope |
| Message metadata (extensions) | Card status updated in place by the server, live for every viewer |
| Voice messages | HD voice notes recorded in Drifty, transcribed by Gemini (Hindi/Hinglish as spoken) |
| Webhooks (`message:send`) | Signed, replay-protected message store (`app/api/nexconn/webhook`), plus a Chat SDK history sync on Summarise |
| Platform Chat API (server) | Access tokens, channel creation, bot sends, metadata writes (`lib/nexconn/api.ts`) |
| ChatUI switches | Message reactions on, delivery dots off, built-in channel list hidden (our own room tabs) |

## Stack

Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 + shadcn/ui · Supabase (Postgres,
auth, storage) · Gemini 3.8 Flash · Vercel · Vitest.

## Setup

Requires Node 18.12+ (developed on Node 22) and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

Open http://localhost:3000. `GET /api/health` shows which config keys are present (names only).

### Environment variables

Values live only in `.env.local` and in Vercel project settings. Never commit them.

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the app |
| `NEXT_PUBLIC_NEXCONN_APP_KEY` | Nexconn App Key (public) |
| `NEXCONN_APP_SECRET` | Nexconn App Secret (server only) |
| `NEXCONN_API_BASE` | Platform Chat API host for your data center (default Singapore) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server only) |
| `GEMINI_API_KEY` | Gemini API key (server only) |
| `AI_MODEL` | `gemini-3.8-flash` |
| `AI_FALLBACK_MODEL` | Comma-separated backup models when the main one is busy or out of quota |
| `SENTRY_DSN` | Error monitoring (optional) |
| `MAGIC_LINK_SIGNING_SECRET` | Signs client invite links and hashes rate-limit keys |
| `CRON_SECRET` | Protects the daily nudges + digest cron (`/api/cron/daily`) |
| `EMAIL_ENABLED` | `true` turns on "Email me a code" and emailed password resets (off by default) |
| `SUPPORT_EMAIL` | Shown on pricing, privacy, terms and "Forgot password?" |
| `SUPABASE_DB_URL` | Postgres connection string, used only by `pnpm db:migrate` (not deployed) |

## Scripts

```bash
pnpm lint        # ESLint
pnpm typecheck   # next typegen + tsc
pnpm test        # Vitest unit tests
pnpm test:e2e    # end-to-end suites against a local server (http://localhost:3101)
pnpm test:demo   # Playwright: demo path, chat layout, webhook-miss sync
pnpm build       # production build
pnpm db:migrate  # apply supabase/migrations/*.sql (needs SUPABASE_DB_URL)
pnpm seed:demo <agency-email>   # add the demo project (local only)
```

### Supabase Auth settings

In Supabase → Authentication → URL Configuration, set **Site URL** to your app URL and add
`<app URL>/auth/callback` (and `http://localhost:3000/auth/callback` for local work) to
**Redirect URLs**. Use a custom SMTP sender for production email.

## How access works

- Agency users sign up with email + password. The first sign-in creates a workspace they own
  (optionally with a demo project).
- Each project has two Nexconn group channels: a **client room** and an **internal room**.
- Clients join from a personal invite link (30 days, revocable, re-issuable). They get a signed
  cookie, no password, and are added only to the client room.
- Tables have row-level security. Writes happen only on the server after a permission check.

## Licences

Drifty's own code is original. `@nexconn/chatui` is Apache-2.0. `@nexconn/engine` and
`@nexconn/chat` are closed-source and used under Nexconn's licence.
