# Drifty

Chat-first client rooms for agencies. Drifty's AI turns client messages and voice notes into a
confirmed change list, flags drift (conflicting feedback, versions that miss a change) and
records a tamper-proof approval.

Built for the Nexconn Build Challenge 2026.

## Nexconn features used

| Feature | Where |
| --- | --- |
| ChatUI for Web (`@nexconn/chatui`) | Every room in the app (`components/chat/`) |
| Chat SDK (`@nexconn/chat`, `@nexconn/engine`) | Connection, live message-metadata events |
| Group channels | Client room and internal room per project |
| Custom messages | `drifty:deliverable` card (more card types in later rounds) |
| Message metadata (extensions) | Card status updated in place by the server |
| Platform Chat API (server) | Access tokens, channel creation, bot sends, metadata writes (`lib/nexconn/api.ts`) |

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
| `SENTRY_DSN` | Error monitoring |
| `MAGIC_LINK_SIGNING_SECRET` | Signs client invite links |
| `SUPABASE_DB_URL` | Postgres connection string, used only by `pnpm db:migrate` (not deployed) |

## Scripts

```bash
pnpm lint        # ESLint
pnpm typecheck   # next typegen + tsc
pnpm test        # Vitest unit tests
pnpm build       # production build
pnpm db:migrate  # apply supabase/migrations/*.sql (needs SUPABASE_DB_URL)
```

### Supabase Auth settings

In Supabase → Authentication → URL Configuration, set **Site URL** to your app URL and add
`<app URL>/auth/callback` (and `http://localhost:3000/auth/callback` for local work) to
**Redirect URLs**. Use a custom SMTP sender for production email.

## How access works

- Agency users sign in with a Supabase magic link. The first sign-in creates a workspace
  they own.
- Each project has two Nexconn group channels: a **client room** and an **internal room**.
- Clients join from a single-use invite link (7 days, revocable). They get a signed cookie, no
  password, and are added only to the client room.
- Tables have row-level security. Writes happen only on the server after a permission check.

## Licences

Drifty's own code is original. `@nexconn/chatui` is Apache-2.0. `@nexconn/engine` and
`@nexconn/chat` are closed-source and used under Nexconn's licence.
