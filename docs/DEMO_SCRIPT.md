# Drifty: 3-minute demo script

Follows PRD section 8. Record on the live app (https://drifty-six.vercel.app), with a laptop for the
agency and a real phone for the client.

## Before recording

1. Sign up a fresh agency account and keep **Add a demo project** ticked. You land on
   **Demo · Sunrise Cafe** with the Demo guide open.
2. On the project page, **Client people → Priya → Copy link again**. Open it on the phone (it
   signs Priya in, so don't open it on the laptop).
3. Download `demo v2` and `demo v3` from the guide.
4. Check the Nexconn webhook is configured, so new phone messages reach the change list. The demo's
   own seeded feedback works without it.

## Script

| Time | Screen | Say / do |
| --- | --- | --- |
| 0:00–0:20 | Landing page | "Agency feedback lives in WhatsApp: five revision rounds, scattered voice notes, and 'I never approved that.' Drifty is the room where that feedback happens, with AI that tracks the drift." |
| 0:20–0:50 | Project page → phone | "Each client gets a room. I invite them by a personal link, with no app or account." Show the phone opening Priya's room with the v1 card. |
| 0:50–1:30 | Laptop: **Summarise feedback** → Internal | "Priya wants a bigger logo, Rahul wants it smaller and a new button. One tap: a change list, each item linked to the client's words." On the phone, the **conflict card**: Priya taps **Choose A**. Back on the laptop, it's confirmed. Confirm the CTA change and **Send brief**. |
| 1:30–2:10 | **Upload v2** (demo v2, copy unchanged) | "The creative uploads v2, but it's held: the client can't see it yet." The drift card shows the CTA as **Missing**. **Back to creative**, upload demo v3 with "Order now": all **Done** → **Send v3 to client**. |
| 2:10–2:35 | Phone: **Approve v3** | The card turns green on both screens. Open **Approval ledger**: exact copy, approver, time, file fingerprint. **Export CSV**. |
| 2:35–3:00 | Dashboard / slide | Traction (pilot agencies, Nexconn usage) and the model: free for 2 clients, Pilot per agency. |

## If something goes wrong live

- **"The AI is busy right now":** wait 30 seconds and press Summarise again. Gemini has had demand
  spikes. A backup model is configured.
- **No conflict card:** the AI didn't find a contradiction this time. The guide marks the step done;
  carry on with the CTA change.
- **Phone shows "Page not found":** the link was opened while signed in as the agency. Use the phone
  or a private window.
