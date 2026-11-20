# Drifty: rules for Claude Code

## What we're building
Drifty: chat-first client rooms for agencies. AI turns client feedback (text + voice)
into a confirmed change list, flags drift, and records approvals.
Specs: docs/PRD.md (build plan, contracts) and docs/SRS.md (requirements). PRD wins on conflict.

## Hard rules
- Nexconn Chat SDK / ChatUI is mandatory for every conversation. Never replace it with our own chat.
- Use the nexconn-chat Skill and docs.nexconn.ai for any Nexconn API. Never guess an API; if unsure, say so.
- AI model: Gemini 3.8 Flash (`gemini-3.8-flash`) via the Gemini API, key in GEMINI_API_KEY.
  Use it for AI-1 to AI-3 and for voice-note transcription if Nexconn voice-to-text is unavailable.
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
