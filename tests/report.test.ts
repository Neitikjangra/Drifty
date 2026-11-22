import { describe, expect, it } from "vitest";
import { buildMonthlyReport, formatDuration, istMonth, monthLabel, parseMonth, reportSummaryText, shiftMonth } from "@/lib/report/rules";

const input = {
  deliverables: [
    { id: "d1", title: "Diwali post", createdAt: "2026-11-01T04:30:00Z" },
    { id: "d2", title: "Banner", createdAt: "2026-10-20T04:30:00Z" },
  ],
  sentVersions: [
    { id: "v1", deliverableId: "d1", number: 1, createdAt: "2026-11-01T04:30:00Z" },
    { id: "v3", deliverableId: "d1", number: 3, createdAt: "2026-11-03T04:30:00Z" }, // v2 was held, never sent
    { id: "b1", deliverableId: "d2", number: 1, createdAt: "2026-10-20T04:30:00Z" },
  ],
  approvals: [
    { versionId: "v3", approvedAt: "2026-11-03T10:30:00Z" }, // 6 h after v3 was sent
    { versionId: "b1", approvedAt: "2026-10-21T04:30:00Z" }, // October: not in the November report
  ],
  changeItems: [
    { status: "confirmed", createdAt: "2026-11-02T04:30:00Z" },
    { status: "done", createdAt: "2026-11-02T04:30:00Z" },
    { status: "suggested", createdAt: "2026-11-02T04:30:00Z" },
    { status: "rejected", createdAt: "2026-11-02T04:30:00Z" },
  ],
  alerts: [
    { kind: "feedback", createdAt: "2026-11-02T05:00:00Z", flagged: true },
    { kind: "version", createdAt: "2026-11-02T06:00:00Z", flagged: false },
  ],
};

describe("monthly client report", () => {
  it("counts only the chosen month (India time)", () => {
    expect(istMonth("2026-10-31T19:00:00Z")).toBe("2026-11"); // 00:30 IST on 1 Nov
    const r = buildMonthlyReport("2026-11", input);
    expect(r.approvals).toBe(1);
    expect(r.deliverablesApproved).toBe(1);
    expect(r.versionsShipped).toBe(2);
    expect(r.changesCaptured).toBe(2); // confirmed + done, not suggested/rejected
    expect(r.driftsCaught).toBe(1);
  });
  it("rounds = versions the client saw before approval, minus one; turnarounds from real timestamps", () => {
    const r = buildMonthlyReport("2026-11", input);
    expect(r.lines[0]).toMatchObject({ title: "Diwali post", approvedVersion: 3, rounds: 1, hoursClientTurnaround: 6 });
    expect(r.avgDaysToApproval).toBe(2.3);
    expect(formatDuration(6)).toBe("6 h");
    expect(formatDuration(72)).toBe("3 days");
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0.2)).toBe("under 1 h");
  });
  it("months: parse, label, shift", () => {
    expect(parseMonth("2026-02")).toBe("2026-02");
    expect(parseMonth("nope", new Date("2026-11-23T00:00:00Z"))).toBe("2026-11");
    expect(monthLabel("2026-11")).toMatch(/November 2026/);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("summary for the client room is factual and credits Drifty", () => {
    const t = reportSummaryText("Sunrise Cafe", buildMonthlyReport("2026-11", input));
    expect(t).toContain("November 2026 report for Sunrise Cafe");
    expect(t).toContain("1 deliverable approved");
    expect(t).toContain("Average time from version to approval: 6 h");
    expect(t).toContain("Tracked with Drifty");
  });
});
