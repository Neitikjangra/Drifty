# Drifty — Software Requirements Specification (MVP)

Nov 20, 2026 · @Renu Chaudhary

## 1. Purpose and scope

Drifty is a chat-first client room for agencies and freelancers. An AI agent tracks **drift**, meaning the gaps between what the client asked for, what the team made, and what was approved, and helps close them before the work ships.

| Item | Decision |
| --- | --- |
| Product | Drifty (formerly "SignOff Room") |
| Competition | Nexconn Build Challenge 2026; submission due **Sun 22 Nov 2026, 11:59 PM IST** |
| Platform for MVP | Web (responsive, works on phone browsers), built on Nexconn ChatUI Web and the Nexconn server SDK |
| Primary users | Small and mid-size agencies and freelancers (India first), plus their client stakeholders |
| Positioning | Not another approval portal. Drifty is the room where feedback actually happens, with AI that turns it into a tracked change list and catches drift |

**The four drifts Drifty tracks:**

1. **Feedback drift:** requests scattered across messages and voice notes, or contradicting each other across stakeholders.
2. **Version drift:** a new version that misses, or quietly reverses, a requested change.
3. **Scope drift:** revision rounds beyond what the contract includes.
4. **Approval drift:** unclear sign-off ("👍" on the image but not the caption), or nobody named as the approver.

**MVP boundary:** one agency workspace, client projects with a client room and an internal room, deliverables with versions, AI change lists, drift checks, approvals, and an approval ledger. Publishing to social networks, billing, and native mobile apps are out of scope (see section 8).

## 2. Market validation

The problem is real and agencies already pay to solve it. But "no-login approval links" are now standard, so Drifty must win on AI drift tracking inside conversation, not on approvals.

### Is it useful? (problem evidence)

- Revision rounds before approval rose from three in 2007 to five, and only a third of agencies say they get constructive feedback ([Marketing Week, on the IPA / BetterBriefs study](https://www.marketingweek.com/constructive-feedback-ipa/)).
- In a Pollfish survey for StreamWork (500 US marketing and ad professionals, Oct 2025), over 60% said they spend up to one full day a week chasing approvals ([StreamWork](https://www.streamwork.com/post/creative-teams-are-losing-up-to-one-full-day-each-workweek-on-approvals)). The survey was commissioned by a vendor.
- Agency owners report clients losing approval requests, no clear record of what was approved, and clients denying approvals later ([r/agency, Reddit mirror](https://libreddit.winscloud.net/r/agency/comments/1k9iiz9/how_are_you_all_managing_client_approvals)).

### Will they pay? (price benchmarks agencies already accept)

| Product | What they pay for | Price (from vendor page) | Source |
| --- | --- | --- | --- |
| Planable | Social planning and approvals | $33 Basic / $49 Pro per workspace per month, unlimited users; Planable suggests one workspace per client | [planable.io/pricing](https://planable.io/pricing/) |
| Filestage | Proofing and review | Free; Starter $199–249/mo; Business $329–399/mo with AI review agents | [filestage.io/pricing](https://filestage.io/pricing/) |
| Ziflow | Proofing and review | Standard $199/mo, Pro $329/mo (as listed on G2) | [G2](https://www.g2.com/products/ziflow/pricing) |

Planable says 7,000+ marketing teams use it ([G2 listing](https://www.g2.com/survey_responses/planable-review-5278389)), and one G2 reviewer returned to it specifically for its approval workflow ([G2](https://g2.com/products/planable/reviews?page=3)). **Price is the main objection.** Reviewers call per-user pricing impractical with many client viewers and too expensive at 10 to 15 clients ([G2](https://g2.com/products/planable/reviews_and_filters?page=9), [G2](https://g2.com/products/planable/reviews?page=80)). Filestage is called pricey for freelancers ([Capterra](https://www.capterra.com/p/162035/Filestage/reviews/?page=4)).

**India context:** India has 11,415 digital marketing companies listed on [Clutch](https://clutch.co/in/agencies/digital-marketing?page=145). One agency-directory benchmark puts Indian social media retainers at roughly ₹20,000 to ₹80,000 a month ([MarketingMonk](https://www.marketingmonk.so/agency-directory/agency/vdoitech-smm-agency-india)). At those retainers, a $33 to $49 per-client tool is a large share of margin, so Drifty must price per agency, not per client.

### Competitive landscape: approvals are commoditised; AI on conversation isn't (yet)

| What competitors already do | Who (evidence) | Implication for Drifty |
| --- | --- | --- |
| No-login client approval links | SocialPilot client portal ([SocialPilot](https://www.socialpilot.co/?p=727953)), Sked ([Sked](https://skedsocial.com/blog/how-to-build-an-agency-approval-process-that-survives-15-clients)), Social Planner magic links ([help article](https://leveluppipeline.freshdesk.com/support/solutions/articles/153000255502-social-planner-share-approve-posts-via-magic-links)), indie tool ApprovePost ([Indie Hackers](https://www.indiehackers.com/product/approvepost)) | Table stakes. Drifty needs it, but can't win on it |
| AI checks on the asset | Filestage review agents (text, grammar, compliance), Business plan and up ([Filestage](https://filestage.io/pricing/)) | Incumbents add AI on files, not on client conversation |
| AI that consolidates feedback from email/Slack | Sold as custom builds taking 3 to 5 weeks ([Enterprise DNA](https://enterprisedna.co/resources/guides/agencies-automate-client-revision-tracking)); a ClickUp agent template ([ClickUp](https://clickup.com/brain/agents/templates/listings/mockup-feedback-summarizer)) | Demand is real, but there's no simple off-the-shelf product for small agencies. **This is Drifty's wedge** |

### Verdict and pricing hypothesis

- **Useful:** yes, with strong evidence.
- **Will pay:** yes, agencies already pay $33 to $400 a month for approval and proofing. Indian small agencies are price-sensitive.
- **Differentiation risk:** high if Drifty is pitched as "approvals." Pitch it as **AI drift tracking from conversation and voice notes**.
- **Adoption risk:** clients default to WhatsApp ([SocialPilot](https://www.socialpilot.co/blog/fix-client-approval-workflows)). Mitigation: a magic link, no install, a WhatsApp-like room, and voice notes.
- **Pricing hypothesis (to test, not verified):** a free tier with 2 active clients, then a flat per-agency plan with unlimited clients and guests, cheaper than one Planable workspace per client. Ask 5 to 10 agencies this weekend what they'd pay.

## 3. Users and roles

There are five human roles plus the AI. Only the agency owner and account manager need an account; clients join by magic link.

| Role | Who | Can do | Joins via |
| --- | --- | --- | --- |
| Agency owner | Founder or ops head | Create the workspace, invite team, see all projects and the ledger | Email sign-up |
| Account manager (AM) | Agency staff who own the client | Create projects, post deliverables, confirm AI change lists, set the approver, set the round limit | Invite |
| Creative | Designer, editor, copywriter | Read change briefs, upload new versions, chat in the internal room | Invite |
| Client approver | One named person per project | Everything a reviewer can, plus Approve / Request changes on deliverables; settles conflicts | Magic link |
| Client reviewer | Other client stakeholders | Chat, react, send voice notes, comment on deliverables; can't approve | Magic link |
| Drifty AI | Bot user in every room | Read room messages, post change lists, drift alerts and nudges; never approves | System |

## 4. Core user journey

&#91;embedded content: Drifty core journey · 7 steps, 1 decision\]

The two AI checks (highlighted) are what make Drifty different. Conflicting client feedback goes back to the approver at the change-list step, and a version that misses a confirmed change goes back to the creative before the client ever sees it.

## 5. Functional requirements

The 14 **Must** items are the demo. Build those first; **Should** items only if time remains before Saturday night.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Agency sign-up and workspace creation (email + password or magic link) | Must |
| FR-2 | Create a client project; Drifty auto-creates a **client room** and an **internal room** as Nexconn group channels and adds the Drifty AI bot to both | Must |
| FR-3 | Invite client people by magic link (no password); the AM marks one as **approver** | Must |
| FR-4 | Post a **deliverable card** (image or video link, caption or copy, version number, due date) into the client room as a Nexconn custom message | Must |
| FR-5 | Client actions on a card: **Approve vX**, **Request changes**, reply to the card | Must |
| FR-6 | Card status updates in place (Draft → In review → Changes requested → Approved) using message extensions | Must |
| FR-7 | Text, image and voice messages in rooms; voice notes transcribed | Must |
| FR-8 | AI builds a **change list** per deliverable version from room messages and transcripts; posted to the internal room | Must |
| FR-9 | AM confirms, edits or rejects each change item; confirmed items become the creative's brief | Must |
| FR-10 | Creative uploads a new version, which creates vN+1 of the card | Must |
| FR-11 | **Version drift check:** AI compares vN+1 against the confirmed change list and flags items missing or reversed (copy text compared directly; images checked by a vision model, marked "needs human check") | Must |
| FR-12 | **Feedback drift alert:** AI flags conflicting requests from different client people and asks the approver to decide, in the client room | Must |
| FR-13 | **Approval ledger:** every approval recorded with version, approver, timestamp and the exact content approved; viewable and exportable as CSV | Must |
| FR-14 | Project dashboard: deliverables by status, open change items, rounds used | Must |
| FR-15 | **Scope drift:** AM sets included rounds; AI warns at the limit and drafts a polite note to the client | Should |
| FR-16 | **Approval drift:** when a client sends a vague "ok" or 👍 outside the card, AI asks in-room whether it approves all parts of vX | Should |
| FR-17 | Nudges: remind the approver if a card is unseen or unapproved 24 hours before its due date (read receipts) | Should |
| FR-18 | Daily digest in the internal room: what moved, what's blocked, who's waiting | Should |
| FR-19 | Hindi/English translation in client rooms | Could |
| FR-20 | Review call from a card (Nexconn Call SDK) | Could |

## 6. AI requirements and human-approval rules

The AI suggests and flags; people decide. Drifty AI never approves work, never sends a creative brief without AM confirmation, and messages the client only with conflict questions, approval checks and nudges (below).

| ID | AI function | Input | Output | Who must confirm |
| --- | --- | --- | --- | --- |
| AI-1 | Change-list extraction | Room messages since the last version, voice transcripts, replies to the card | JSON list: item, source message id, author, version, type (copy / visual / other) | AM confirms each item |
| AI-2 | Conflict detection | Change items from more than one client person | Conflict pair + a question to the approver in the client room | Approver decides |
| AI-3 | Version drift check | Confirmed change list, vN and vN+1 text, both images | Per item: done / missing / reversed / needs human check | AM reviews before sending to client |
| AI-4 | Ambiguous-approval prompt (Should) | A vague approval-like message outside a card | In-room question: "Does this approve all of v3?" | Client answers |
| AI-5 | Scope drift note (Should) | Rounds used vs included | Warning to AM + draft client message | AM sends or discards |
| AI-6 | Nudge and digest (Should) | Read receipts, due dates, statuses | Reminder or digest message | Automatic, within AM-set rules |

**Quality rules:**

- Every change item links back to its source message, so a person can check it in one tap.
- Low-confidence items are marked "unclear" and turned into a question, never guessed.
- Use structured output (a JSON schema) for AI-1 to AI-3, and reject any response that doesn't parse.
- AI never edits or deletes client messages.

## 7. Nexconn SDK usage and architecture

Every client action in Drifty is a Nexconn message or message update. That's the "real, measurable" SDK usage the rules require.

| Nexconn capability | Used for | Priority |
| --- | --- | --- |
| Group channels | Client room and internal room per project | Must |
| Custom messages | Deliverable card, change-list card, drift-alert card, approval receipt | Must |
| Message extensions | Update card status and approval state in place | Must |
| Reply to message | Tie feedback to a specific card or version | Must |
| Image, file and voice messages | Drafts, screenshots, voice feedback | Must |
| Voice-to-text (built-in) | Transcribe voice notes for AI-1 | Must (fall back to an external speech-to-text API if unavailable) |
| Webhooks (message events) | Send every room message to the Drifty backend | Must |
| Server SDK send, stream send | AI bot posts cards and summaries | Must |
| Read receipts | "Approver has seen v3"; nudge rules | Should |
| Push (FCM/APNs) | Nudges on mobile | Could |
| Translation (built-in) | Hindi/English client rooms | Could |
| Call SDK | Review call from a card | Could |

**Architecture (data flow):**

1. **Frontend:** a web app (React or Next.js) using Nexconn **ChatUI Web** for rooms, with custom renderers for Drifty cards. The ChatUI is built as Lit web components with custom message components ([repo](https://github.com/NexconnAI-Dev/nexconn-chatui-web)).
2. **Backend:** Node.js with the Nexconn **server SDK** ([repo](https://github.com/NexconnAI-Dev/nexconn-server-sdk-node)). It issues user tokens, creates channels, and posts as the Drifty AI bot.
3. **Webhook endpoint** receives message events. New feedback queues an AI job for that deliverable.
4. **AI service:** one LLM with a vision model and JSON-schema outputs (AI-1 to AI-3); speech-to-text if the built-in one isn't enough.
5. **Database:** Postgres (e.g. Supabase) for workspaces, projects, deliverables, versions, change items and the ledger. **File storage** holds draft assets.
6. **Results** go back into rooms as custom messages; status changes go out as message extensions.

**First spike (do it before anything else):** render a custom deliverable card with buttons in ChatUI Web, and update its status from the server through a message extension. Every Must requirement depends on this.

## 8. Data, quality, scope and acceptance

The MVP is done when the 8 acceptance checks below pass on the live URL with at least one real agency and its client.

### Data model (core entities)

| Entity | Key fields |
| --- | --- |
| Workspace | id, name, owner\_id, plan |
| User | id, name, email or phone, role, nexconn\_user\_id |
| Project | id, workspace\_id, client\_name, approver\_user\_id, rounds\_included, client\_channel\_id, internal\_channel\_id |
| Deliverable | id, project\_id, title, due\_date, status, current\_version |
| Version | id, deliverable\_id, number, asset\_url, copy\_text, card\_message\_id, created\_by, created\_at |
| ChangeItem | id, version\_id, text, type, source\_message\_ids, author\_id, status (suggested / confirmed / rejected / done / missing / reversed) |
| DriftAlert | id, deliverable\_id, kind (feedback / version / scope / approval), detail, resolved\_by, resolved\_at |
| Approval | id, version\_id, approver\_id, timestamp, approved\_copy\_snapshot, approved\_asset\_hash |

### Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | AI change list posted within 15 seconds of the AM pressing "Summarise feedback" |
| NFR-2 | Messages and card status updates appear for all room members within 2 seconds (Nexconn real-time) |
| NFR-3 | A client can open a magic link and approve on a phone browser with no install and no password |
| NFR-4 | Ledger entries can't be edited after creation |
| NFR-5 | Each workspace's data is isolated; magic links expire and can be revoked |
| NFR-6 | Works in Chrome and Safari, desktop and mobile |
| NFR-7 | Stays within Nexconn's free tier (10K MAU) for the competition |

### Out of scope for the MVP

Publishing to social networks, billing and subscriptions, native iOS/Android apps, Figma/Canva/Drive integrations, WhatsApp Business API notifications, multi-level approval chains, and image annotation on the asset.

### Acceptance criteria (demo checklist)

- [ ] AM creates a project and invites 2 client people by link; both rooms are created in Nexconn
- [ ] AM posts v1 as a deliverable card; the client sees it live
- [ ] Two client people send conflicting feedback (one by voice note); the AI raises a feedback-drift alert and the approver resolves it
- [ ] AI change list appears in the internal room; the AM confirms it
- [ ] Creative uploads v2 that misses one confirmed change; the AI raises a version-drift alert naming the missing item
- [ ] v3 fixes it; the approver taps Approve v3 and the card turns green for everyone
- [ ] Ledger shows v3, approver, time and approved copy; CSV export works
- [ ] Nexconn console shows real users and messages from at least one real agency and its client

### Build order to 22 Nov

1. **Fri:** the custom-card + message-extension spike, auth and magic links, project creation with both rooms (FR-1 to FR-6).
2. **Sat:** voice notes, AI-1/AI-2/AI-3, ledger, dashboard (FR-7 to FR-14); recruit real agencies by evening.
3. **Sun:** real users, bug fixes, demo video, PDF write-up, public repo, deploy. Add Should items only if Must items are solid.
