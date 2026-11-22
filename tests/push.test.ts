import { describe, expect, it } from "vitest";
import { pushCopy, subscriptionSchema } from "@/lib/push/rules";

const pid = "11111111-1111-1111-1111-111111111111";

describe("push notifications", () => {
  it("team alerts link to the project and never include message text", () => {
    const p = pushCopy({ type: "feedback", projectId: pid, clientName: "Sunrise Cafe", authorName: "Priya" });
    expect(p).toEqual({ title: "New feedback · Sunrise Cafe", body: "Priya sent a message in the client room.", url: `/app/projects/${pid}`, tag: `feedback-${pid}` });
    expect(pushCopy({ type: "approved", projectId: pid, clientName: "Sunrise Cafe", authorName: "Priya", title: "Diwali post", number: 3 }).body).toBe("Priya approved Diwali post v3.");
    expect(pushCopy({ type: "changes", projectId: pid, clientName: "Sunrise Cafe", authorName: "Priya", title: "Diwali post", number: 2 }).title).toBe("Changes requested · Sunrise Cafe");
  });
  it("client alerts open their room", () => {
    const v = pushCopy({ type: "version", projectId: pid, title: "Diwali post", number: 2 });
    expect(v.url).toBe(`/room/${pid}`);
    expect(v.body).toBe("Diwali post v2 is waiting for you.");
    expect(pushCopy({ type: "reply", projectId: pid, clientName: "Sunrise Cafe" }).url).toBe(`/room/${pid}`);
  });
  it("long names are clipped", () => {
    const p = pushCopy({ type: "version", projectId: pid, title: "x".repeat(200), number: 1 });
    expect(p.body.length).toBeLessThan(90);
  });
  it("only https push endpoints with keys are accepted", () => {
    const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
    expect(subscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }).success).toBe(true);
    expect(subscriptionSchema.safeParse({ endpoint: "http://evil.test/x", keys }).success).toBe(false);
    expect(subscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/x" }).success).toBe(false);
  });
});
