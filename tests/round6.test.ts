import { describe, expect, it } from "vitest";
import { digestText, isVagueApproval, istDate, nudgeText, nudgeWhen, scopeNoteTemplate, scopeState } from "@/lib/round6/rules";

describe("FR-16 vague approvals", () => {
  it("catches short approval-like messages in English, Hinglish and emoji", () => {
    for (const t of ["ok", "OK!", "Okay team", "👍", "👍🏽👍", "✅", "looks good", "LGTM", "theek hai", "Thik hai ji", "badhiya 👌", "done", "go ahead", "chalega"]) {
      expect(isVagueApproval(t), t).toBe(true);
    }
  });
  it("ignores change requests, questions, doubts and long messages", () => {
    for (const t of [
      "ok but make the logo bigger",
      "ok?",
      "not ok",
      "theek hai lekin CTA change karo",
      "Looks good, can we add the address",
      "Thanks team 🙏",
      "This looks good overall and I like the colours a lot",
      "",
      null,
    ]) {
      expect(isVagueApproval(t as string), String(t)).toBe(false);
    }
  });
});

describe("FR-17 nudges", () => {
  const nineIst = new Date("2026-11-22T03:30:00Z"); // 09:00 IST, 22 Nov
  it("only for unapproved cards due today or tomorrow (India time)", () => {
    expect(istDate(nineIst)).toBe("2026-11-22");
    expect(nudgeWhen("2026-11-23", "in_review", nineIst)).toBe("tomorrow");
    expect(nudgeWhen("2026-11-22", "in_review", nineIst)).toBe("today");
    expect(nudgeWhen("2026-11-25", "in_review", nineIst)).toBeNull();
    expect(nudgeWhen("2026-11-23", "approved", nineIst)).toBeNull();
    expect(nudgeWhen("2026-11-23", "changes_requested", nineIst)).toBeNull();
    expect(nudgeWhen(null, "in_review", nineIst)).toBeNull();
  });
  it("names the approver and the date", () => {
    const t = nudgeText({ title: "Diwali post", version: 3, dueDate: "2026-11-23", when: "tomorrow", approver: "Priya" });
    expect(t).toContain("Diwali post v3 is due tomorrow (23 Nov)");
    expect(t).toContain("Priya, could you");
  });
});

describe("FR-15 scope drift", () => {
  it("warns at the limit and beyond", () => {
    expect(scopeState(1, 2)).toBeNull();
    expect(scopeState(2, 2)).toBe("at_limit");
    expect(scopeState(3, 2)).toBe("over");
    expect(scopeState(0, 0)).toBeNull();
  });
  it("drafts a polite note", () => {
    expect(scopeNoteTemplate({ title: "Diwali post", roundsUsed: 2, included: 2, state: "at_limit" })).toContain("last of the 2 revision rounds");
    expect(scopeNoteTemplate({ title: "Diwali post", roundsUsed: 3, included: 2, state: "over" })).toContain("round 3, beyond the 2 included");
  });
});

describe("FR-18 daily digest", () => {
  const base = { clientName: "Sunrise Cafe", approvals: [], newVersions: [], changeLists: 0, clientMessages: 0, deliverables: [] };
  it("says nothing when nothing moved and nobody is waiting", () => {
    expect(digestText(base)).toBeNull();
    expect(digestText({ ...base, deliverables: [{ title: "Old", version: 2, status: "approved", dueDate: null, openConflicts: 0 }] })).toBeNull();
  });
  it("lists what moved, what's blocked and who is waiting", () => {
    const t = digestText({
      ...base,
      approvals: [{ title: "Diwali post", version: 3, by: "Priya" }],
      clientMessages: 4,
      deliverables: [
        { title: "Banner", version: 2, status: "draft", dueDate: "2026-11-24", openConflicts: 0 },
        { title: "Reel", version: 1, status: "in_review", dueDate: null, openConflicts: 1 },
      ],
    })!;
    expect(t).toContain("Daily digest · Sunrise Cafe");
    expect(t).toContain("Diwali post v3 approved by Priya");
    expect(t).toContain("4 new client messages");
    expect(t).toContain("Banner v2: held for the drift check");
    expect(t).toContain("Reel v1: the approver hasn't settled 1 conflict");
    expect(t).toMatch(/Waiting on the client:\n• Reel v1/);
    expect(t).toMatch(/Waiting on the team:\n• Banner v2, due 24 Nov/);
  });
});

import { formatSaved, timeSaved } from "@/lib/dashboard/time-saved";
describe("time saved (estimate)", () => {
  it("10 min per change list, 15 per drift, 5 per approval", () => {
    expect(timeSaved({ changeLists: 2, drifts: 3, approvals: 4 }).minutes).toBe(85);
    expect(formatSaved(45)).toBe("~45 min");
    expect(formatSaved(85)).toBe("~1.5 hours");
    expect(formatSaved(60)).toBe("~1 hour");
  });
});
