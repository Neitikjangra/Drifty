# Drifty: master build prompt for Claude Code

Paste everything below the line into Claude Code, opened in the Drifty folder.
If a session ends or runs out of context, start a new one and paste only the
"RESUME" block at the bottom.

---------------------------------------------------------------------------

You are the lead engineer building **Drifty** end to end, from an empty repo to a
deployed, production-quality web app that agencies can start using this weekend.
It is our entry for the Nexconn Build Challenge 2026 (deadline Sun 22 Nov 2026,
11:59 PM IST). Work fast, but never ship something broken.

## 0. Read first (do this before writing any code)

1. Read `CLAUDE.md`, `docs/PRD.md` and `docs/SRS.md` completely. The PRD wins if they
   disagree. The AI model is **Gemini 3.8 Flash** (`gemini-3.8-flash`, key in
   `GEMINI_API_KEY`). Ignore any older mention of Anthropic, Gemma or a separate STT API.
2. Load and use the **nexconn-chat** Skill for every Nexconn integration. For anything
   the Skill doesn't cover, read docs.nexconn.ai. Never invent a Nexconn API, package
   export, webhook field or signature scheme. If you can't confirm one, stop and tell me.
3. Check the environment: Node version, pnpm, git, vercel CLI, and that `.env.local`
   exists with every key from `.env.example` filled in (print only which keys are
   present or missing, never their values).
4. Create `docs/PROGRESS.md` with a checklist of Rounds 0–6 and keep it updated after
   every meaningful step, so any new session can resume exactly where you stopped.
5. Reply with: a 5-line summary of the plan, anything missing, and the exact things
   I must do by hand before Round 0. Then wait for me to say "go".

## 1. How we work

- We are on **Windows PowerShell 5.1**. Use commands that work there (no `&&`, use
  `;` or separate lines). Use pnpm.
- Build in the rounds from PRD section 5, **in order**: Round 0 → 1 → 2 → 3 → 4 → 5,
  then Round 6 (Should items) only if I approve. **Never build Could items**
  (FR-19 translation, FR-20 calls).
- Each round's scope is exactly what PRD section 5 lists for it. Each round's
  contracts (tables, message types, AI prompts, routes) are in PRD section 6. The
  production bar is PRD section 7. Requirements are the FR / AI / NFR ids in the SRS.
- **Every round ends with something I can click.** At the end of each round:
  1. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass (add tests for new logic).
  2. Commit with a clear message and push to GitHub.
  3. Deploy to Vercel production (`vercel --prod`) and give me the live URL.
  4. Update `docs/CHANGELOG.md` and `docs/PROGRESS.md`.
  5. Stop and report in this format:
     - **Done:** what you built (FR ids)
     - **Try it:** numbered steps to test on desktop and phone (from the PRD's Try it)
     - **Human tasks now:** anything I must do (console settings, keys, data)
     - **Known issues / risks**
  6. Wait for me to reply "approved" or list bugs. Fix bugs before the next round.
- If something blocks you for more than ~20 minutes (an SDK capability, a webhook
  format, an auth error), stop, explain what you tried, and propose the fallback from
  PRD section 8's risk table. Don't silently change the architecture.
- Ask me before: adding a paid service, changing the stack, changing a contract in
  PRD section 6, or deleting data.

## 2. Non-negotiable rules (from the rule book and the PRD)

- Every conversation in the product runs on the **Nexconn Chat SDK / ChatUI**, with
  real, measurable usage: rooms are Nexconn group channels, cards are Nexconn custom
  messages, status changes are Nexconn message extensions/metadata, and the AI bot
  posts through the Nexconn server SDK. Never build our own chat transport.
- Web only (responsive; must work at 375 px on a phone browser).
- Secrets live only in `.env.local` and Vercel env vars. Never print, log or commit
  keys, App Secret, user IDs or message contents. `.env.local` must be git-ignored.
  The repo is public.
- Every permission is checked on the server; approver-only actions are verified on
  the server; internal rooms never include client guests.
- `approvals` is insert-only. Card status is changed only by the server.
- The AI never approves anything, never sends a brief without AM confirmation, and
  only messages clients with conflict questions (and FR-16/17 if Round 6 is built).
- All AI calls use Gemini 3.8 Flash with JSON-schema structured output (Zod), retry
  once on parse failure, link every change item to its source message, and run only
  on a button press or a new version upload (never per message). Use thinking level
  low for AI-1/AI-2 and medium for AI-3. Voice notes: use Nexconn voice-to-text if it
  works server-side, otherwise transcribe the audio with Gemini 3.8 Flash.
- Original code only; respect licences (ChatUI is Apache-2.0; `@nexconn/engine` and
  `@nexconn/chat` are closed-source under their own licence).

## 3. Quality bar ("we can sell this")

- Clean, consistent UI (Tailwind + shadcn/ui), clear typography, loading / empty /
  error states on every screen, no console errors, no dead ends.
- The client experience must feel as simple as WhatsApp: open link → room → tap.
- Friendly error messages; Sentry wired in; `/api/health` endpoint.
- RLS on every table; rate limits on auth, join, upload and AI routes; uploads ≤ 20 MB.
- From Round 5: a Playwright test of the full demo path passes against production.
- README: what Drifty is, the Nexconn features used, setup steps, env vars (names only).

## 4. Round-by-round (details are in PRD section 5)

- **Round 0:** scaffold + Supabase + Vercel deploy + Nexconn token route + `/spike`
  page proving a custom `drifty:deliverable` card whose Approve button updates status
  live in two browsers. If ChatUI can't render interactive custom messages, STOP and
  report options (fallback: Chat SDK messages rendered in our own React list).
- **Round 1:** FR-1..FR-3: sign-up, workspace, projects, two rooms + AI bot,
  magic-link client invites, approver role, access control.
- **Round 2:** FR-4, 5, 6, 10, 13 core: deliverable cards, versions, approve /
  request changes, in-place status, immutable approval rows.
- **Round 3:** FR-7, 8, 9, 12: voice + transcripts, webhook ingestion, AI-1 change
  list card, AM confirm/edit/reject, AI-2 conflict card for the approver.
- **Round 4:** FR-11, 13 full, 14: AI-3 drift check card, ledger page + CSV, dashboard.
- **Round 5:** production hardening per PRD section 7, landing page + pricing + FAQ +
  privacy/terms pages (I'll supply the legal text), onboarding with a seeded demo
  project, Playwright demo test.
- **Round 6 (only if I approve):** FR-17 nudges → FR-16 approval drift → FR-15 scope
  drift → FR-18 digest, each shipped separately. Code freeze Sun 4 PM IST.

## 5. Final deliverables you prepare for me (after Round 5)

- `docs/SUBMISSION.md`: draft of the PDF write-up following PRD section 8 (problem,
  what Drifty does, **every feature that uses the Nexconn SDK**, architecture, AI
  design, a placeholder for traction numbers, business model, and placeholders for
  the Nexconn App Key, live URL, video link and GitHub link).
- `docs/DEMO_SCRIPT.md`: the 3-minute demo steps with the exact clicks and test data.
- A seed script that creates the demo workspace (fictional brand, 3 drafts, sample
  feedback) so I can record the video in one take.

Start with section 0 now.

---------------------------------------------------------------------------

## RESUME (paste this in any new session)

Read CLAUDE.md, docs/PRD.md, docs/SRS.md, docs/PROGRESS.md and docs/CHANGELOG.md, and
the master prompt in docs/MASTER_PROMPT.md. Tell me which round we're in and what's
left in it, then continue from there following the master prompt's rules. Stop and
report at the end of the round as before.
