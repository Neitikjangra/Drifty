/** Demo project content (shared by the seed and the on-page guide). */
export const DEMO = {
  clientName: "Demo · Sunrise Cafe",
  deliverable: "Diwali post",
  v1: {
    image: "/demo/sunrise-v1.png",
    copy: "Sunrise Cafe Diwali special: 20% off all mithai boxes. Buy now.",
  },
  /** For the drift check step: v2 makes the logo bigger but keeps "Buy now" (misses the CTA). */
  v2: { image: "/demo/sunrise-v2.png", copy: "Sunrise Cafe Diwali special: 20% off all mithai boxes. Buy now." },
  v3: { image: "/demo/sunrise-v3.png", copy: "Sunrise Cafe Diwali special: 20% off all mithai boxes. Order now." },
  people: [
    { key: "priya", name: "Priya (demo client)", role: "approver" as const, contact: "priya@demo.drifty.app" },
    { key: "rahul", name: "Rahul (demo client)", role: "reviewer" as const, contact: "rahul@demo.drifty.app" },
  ],
  feedback: [
    // Hinglish on purpose: the change list comes out in English ("Make the logo bigger").
    { from: "priya", text: "Looks lovely! Logo thoda bada karo please, phone pe theek se dikh nahi raha." },
    { from: "rahul", text: "I'd like the logo smaller so the mithai is the hero of the post. Also change the button from 'Buy now' to 'Order now'." },
    { from: "priya", text: "Thanks team 🙏" },
  ],
  internalWelcome:
    "Welcome to your demo project. The client (Priya and Rahul, both demo people) already left feedback on v1 in the client room. " +
    "Follow the Demo guide on the project page: summarise, settle the conflict as Priya, upload v2, see the drift check, then approve and open the ledger.",
};
