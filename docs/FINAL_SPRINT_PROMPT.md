# Drifty: final sprint prompt (paste everything below the line into Claude Code)

---------------------------------------------------------------------------

We are in the final sprint. Submission closes TODAY, Sun 22 Nov 2026, 11:59 PM IST.
**Hard code freeze: 8:30 PM IST.** After that: bug fixes only, no new features.

Judging is 50% Completeness & UX, 30% Innovation & Scenario Value, 20% Business &
Growth, plus a traction bonus. A smooth demo path beats extra features. Follow
CLAUDE.md and docs/PRD.md rules (Nexconn for all chat, secrets only in env vars,
server-side permission checks, approvals insert-only, AI never approves).

## Rules for this sprint
- Do the tasks **in the order below**. After EACH task: lint + typecheck + tests,
  commit, deploy to production, and give me a 3-line "Try it". Then continue to
  the next task without waiting, unless something is blocked.
- If any task takes more than 45 minutes or risks breaking the demo path, STOP it,
  revert it, tell me, and move to the next one.
- Never break: sign-up/login (email + password), invite links, client room,
  deliverable cards, Approve / Request changes, voice notes, Summarise (AI change
  list), conflict card, drift check, approval ledger.
- Don't change the database schema unless a task requires it; if you do, apply the
  migration with SUPABASE_DB_URL and keep it backwards compatible.

## Task 1: Fix visible bugs (UX is 50% of the score)
1. Chat: my own (right-side) message bubbles are cut off at the right edge
   ("testing webhook" shows as "testing w", the voice-note bubble is clipped).
   Make sent bubbles fit inside the chat column with right padding and text
   wrapping, on desktop and at 375 px.
2. The small empty circles / "..." next to sent messages look like a stuck loading
   state. Show a clear "Sent" / "Read" tick, or hide them.
3. "Summarise feedback" must be clearly visible: a prominent button on every
   deliverable that is In review or Changes requested, in the Deliverables panel
   AND in the Internal room. If there is no new client feedback, show a friendly
   "No new client feedback since vX" instead of hiding the button.
4. Email is not working (Gmail SMTP fails). Hide "Email me a code instead", and make
   "Forgot password?" show "Contact support to reset your password" with the
   SUPPORT_EMAIL value. Put both behind an env flag EMAIL_ENABLED (default false)
   so they can be switched back on later.
5. Confirm the Nexconn webhook is storing real client-room messages (I sent
   "testing webhook" and "please make the logo bigger" in the "holi" project).
   Report what you find.

## Task 2: AI reliability for the demo
- Keep the Gemini model fallback list (gemini-3.8-flash first, then the lite
  models) and the 10-minute skip for models whose quota is used up.
- Add a clear UI message if ALL models fail: "AI is busy, try again in a minute",
  never a crash or a blank card.
- Cache each Summarise / drift result so re-opening a card never re-calls the AI.
- Tell me how many AI calls the full demo path uses, so I know if the free quota
  will last through the video.

## Task 3: Hinglish / Hindi feedback (India-specific innovation)
- Update AI-1 (change list) and AI-2 (conflicts) so they understand Hindi,
  Hinglish and English input, from text messages and voice-note transcripts, and
  ALWAYS output change items in clear English. Keep the original quote as the
  item's source (shown under the item, linked to the message).
- If Nexconn voice-to-text isn't available, transcribe voice notes with Gemini
  (audio input) and keep Hindi/Hinglish as spoken.
- Test: text "logo thoda bada karo aur button pe Book now likho" -> 2 items:
  "Increase the logo size" and "Change the button text to 'Book now'".
- Add a small "Understands Hindi & Hinglish" note in the client room's welcome
  message and on the landing page.

## Task 4: "Time saved" card (business value)
- On each project dashboard and on the Projects page, show:
  "Drifty saved you ~X hours · N drifts caught (estimate)".
- Estimate: 10 min per AI change list generated, 15 min per drift alert or
  conflict caught, 5 min per approval recorded. Show the breakdown on hover/tap.
- Clearly label it "estimate".

## Task 5: "Share on WhatsApp" for invites
- Next to "Copy link again" in Client people, add a green "Share on WhatsApp"
  button that opens
  https://wa.me/?text=<urlencoded "Hi <name>, please review <project> on Drifty: <link>">
- Works on phone (opens the app) and desktop (opens WhatsApp Web).

## Task 6: Judge-friendly demo
- Make sure "Add a demo project" on sign-up works for ANY new user and creates
  their OWN copy (fictional brand, 2 drafts, sample client feedback including one
  Hinglish message and one conflict), so many judges can try it at once without
  affecting each other.
- On the landing page hero, add "Try the live demo" -> sign-up with the demo
  project pre-ticked.
- Generate public/demo-qr.png (QR code to https://drifty-six.vercel.app) for the
  PDF and the video's last frame.

## Task 7: Visual polish (only after Tasks 1–6 are done)
- Consistent colours and spacing; a simple Drifty logo/wordmark; nicer
  deliverable, change-list, conflict and drift cards (clear status colours:
  in review = amber, changes requested = orange, approved = green, drift = red).
- Landing page: headline "Stop chasing client feedback on WhatsApp", a 3-step
  how-it-works, the time-saved stat, pricing (Free: 2 active clients; Pilot plan:
  contact), FAQ, footer links (privacy, terms, support).
- No layout changes that risk the demo path. Check at 375 px and on desktop.

## Task 8: Submission docs (do this by 8:30 PM regardless of where you are)
Update:
- docs/SUBMISSION.md, the PDF write-up:
  1. One-line pitch: "Indian agencies run client approvals on WhatsApp. Drifty
     is a Nexconn-powered chat room where clients talk naturally (even Hinglish
     voice notes); AI turns it into a change list, catches conflicting feedback
     and missed changes, and records a dispute-proof approval."
  2. Problem and evidence (from docs/SRS.md section 2, with the sources).
  3. Features, with screenshots placeholders.
  4. **Nexconn SDK usage**: group channels, custom messages (5 card types),
     message extensions (live status), voice messages + voice-to-text, webhooks
     (message:send), server SDK bot sends / stream sends, read receipts if used.
     Include real numbers: how many channels, messages and users exist now
     (query our DB; no personal data).
  5. Architecture diagram (text/mermaid) and AI design + human-approval rules.
  6. Traction: placeholders for agencies, users, messages, quotes, and Nexconn
     Console screenshots.
  7. Business model, pricing, roadmap (domain + email, Razorpay subscriptions,
     WhatsApp notifications, image pin comments, Drive/Figma/Canva import,
     multi-step approvals, PWA + push, monthly client report).
  8. Placeholders: Nexconn App Key, live URL, video link, GitHub link, QR code.
- docs/DEMO_SCRIPT.md, 3 minutes: before/after WhatsApp chaos (15 s), create
  project + WhatsApp invite, client Hinglish voice note -> English change list,
  conflict card -> approver decides, v2 misses CTA -> drift alert, v3 -> Approve
  -> green on both screens, ledger, time-saved card, QR "try it yourself".
- README.md: what Drifty is, Nexconn features used, live URL, setup, env var
  names only.

## Final check (before you tell me you're done)
- Run all test suites + the Playwright demo path against production.
- Confirm the repo is public and no secrets are in git history.
- Give me: the list of what shipped, what was dropped, the Try it steps for the
  full demo path, and anything I must do by hand.

Start with Task 1 now.
