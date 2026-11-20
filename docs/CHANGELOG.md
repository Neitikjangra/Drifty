# Changelog

## Round 0: foundation + Nexconn spike (in progress, not deployed yet)

**Built**
- Next.js 16 + TypeScript strict + Tailwind 4 + shadcn/ui scaffold, PRD section 4 layout.
- Supabase server/browser clients (`lib/db/`).
- Nexconn Platform Chat API client with request signing and backup-domain failover (`lib/nexconn/`).
- `POST /api/nexconn/token`: Nexconn token for the signed-in Supabase user.
- `GET /api/health`.
- `/spike`: ChatUI Web in a test group channel; `drifty:deliverable` custom card with status chip
  and Approve button; Approve → server sets message metadata → card updates live for everyone.
- Unit tests for signing, IDs and card status.

**Try it** (needs Nexconn keys in `.env.local` and `SPIKE_ENABLED=1`)
1. `pnpm dev`, open http://localhost:3000/spike in two browsers.
2. Join as Alice in one and Bob in the other.
3. Press **Post test card**, then **Approve v1** in either browser.
4. The chip turns green in both within 2 seconds.

**Verified locally (2026-11-20):** Approve in one browser turns the chip green in both within
2 s; text chat works both ways; at 375 px ChatUI shows a single-pane room view.

**Fixed during the spike:** Lit dev/prod mismatch crash in `pnpm dev`; card status reverting
to the stale value; Approve clicks being lost when ChatUI re-rendered on hover; room not
opening on its own.

**Not yet done:** deploy to Vercel, test on a real phone.
