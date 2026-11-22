# Drifty: submission write-up

Source for the PDF write-up (PRD section 8). Sections marked **(fill in)** need numbers or links
only the team has.

- **Live app:** https://drifty-six.vercel.app
- **GitHub:** https://github.com/Neitikjangra/drifty
- **Demo video:** (fill in)
- **Nexconn App Key:** (fill in from the Nexconn Console; it's the public client key, not the App Secret)

## 1. Problem and evidence

Agencies run client feedback through WhatsApp threads, screenshots and voice notes. Revision
rounds before approval rose from three to five (IPA / BetterBriefs, via Marketing Week), and only a
third of agencies say they get constructive feedback. The expensive failures are the same every
time: a request gets lost in the thread, two client people ask for opposite things, the next
version quietly misses a change, and "I never approved that" (SRS section 1).

## 2. What Drifty does: the drifts it tracks

| Drift | What Drifty does |
| --- | --- |
| **Feedback drift**: requests scattered across messages and voice notes, or contradicting each other | *Summarise feedback* turns the client room into a change list (AI-1). Every item links to its source message, and the AM confirms, edits or rejects each one. Conflicts between two client people go to the approver as a card (AI-2). |
| **Version drift**: a new version misses or reverses a confirmed change | The new version is **held** from the client while AI-3 checks the copy word for word and compares the images. The AM sends it to the client or back to the creative. |
| **Approval drift**: unclear sign-off | Only the named approver can approve, checked on the server. Every approval lands in an insert-only ledger with the exact copy and the file's SHA-256, exportable as CSV. |

Scope drift and approval-drift nudges (FR-15/16) are Round 6 "Should" items.

## 3. Features that use the Nexconn SDK

- **Group channels:** each project gets a client room and an internal room, created server-side
  over the Platform Chat API. Clients only ever join the client room.
- **ChatUI Web** (`@nexconn/chatui` 26.5.0) renders every room. There is no custom chat UI.
- **Custom messages** rendered by our own custom elements, registered via `registerCustomMessages`:
  `drifty:deliverable`, `drifty:changelist`, `drifty:conflict`, `drifty:drift`, `drifty:receipt`.
- **Message metadata (extensions):** card status (Approved, Superseded, each item's status, the
  conflict choice, the drift decision) is written by the server and updates live for everyone
  through `onMessageMetadataUpdated`.
- **Voice messages:** HD voice (`RC:HQVCMsg`) sent from our recorder, which we built because ChatUI
  Web has none. Played back through an access-checked URL and transcribed by Gemini.
- **Server sends as the Drifty AI bot:** cards, briefs, conflict notes.
- **Webhooks** (`message:send`): every room message reaches our backend. Signature and App Key are
  checked, stale timestamps rejected, and duplicates dropped.
- **Access tokens** issued server-side per user, with a connection keeper (reconnect, token refresh).

## 4. Architecture and AI design

```
Phone / browser ── Next.js 16 (Vercel) ── Supabase (Postgres + RLS, private storage)
     │  ChatUI Web           │  route handlers: every permission re-checked
     └──── Nexconn ◄─────────┤  Platform Chat API (channels, bot sends, metadata)
           (Singapore)       │  ◄── webhook (message:send)
                             └── Gemini API (AI-1 change list, AI-2 conflicts, AI-3 drift, voice)
```

AI rules, all enforced in code:

- AI runs only on a button press or a new version, never on every message. Input is capped at
  the last 200 messages.
- Output must match a JSON schema (validated with Zod, retried once).
- Items without a real source message are dropped.
- Low-confidence items become questions.
- The AI never approves and never confirms. It messages clients only to ask the approver about a
  conflict.
- If the AI is unavailable, the team is told: "Couldn't summarise", "The conflict check didn't
  run", or drift items become "Check by eye". Nothing reaches the client unchecked.

## 5. Traction **(fill in)**

- Pilot agencies:
- Client people invited / rooms active:
- Messages and voice notes through Nexconn:
- Quotes:

## 6. Business model and roadmap

- **Free:** 2 active clients, so a freelancer can run real work.
- **Pilot:** more clients, onboarding help, priced per agency (not per client; Indian retainers
  can't carry $33–49 per client).
- **Next:** scope-drift warnings when rounds run out (FR-15), approval-drift checks for a vague
  "ok 👍" (FR-16), nudges and a daily digest (FR-17/18), WhatsApp hand-off links.

## 7. Production readiness (PRD section 7)

- **Secrets:** server-only. `.env.local` is git-ignored.
- **Access:** RLS on every table. Server checks on every route. Approver-only actions verified.
  Clients never join internal rooms.
- **Ledger:** insert-only (privileges revoked plus a trigger).
- **Rate limits:** auth, join, upload, AI and write routes, per user and per IP (shared in Postgres).
- **Monitoring:** Sentry via `SENTRY_DSN` (error class and stack only, no message text). Background
  jobs retry 3 times and are recorded in `jobs`. Health check at `/api/health`.
- **Tests:** 57 unit tests, 5 end-to-end suites (over 200 checks) and a Playwright demo-path test on a
  phone-sized screen.
