import { describe, expect, it } from "vitest";
import { sanitizeDrift } from "@/lib/ai/guards";
import { driftSchema } from "@/lib/ai/schemas";
import { buildDashboard, waitingOn } from "@/lib/dashboard/rules";
import { canAct } from "@/lib/deliverables/rules";
import { backToCreativeText, driftCounts, itemsToCheck, sendLabel, type ItemForCheck } from "@/lib/drift/rules";
import { csvCell, filterLedger, filterQuery, istDay, parseFilter, toCsv, type LedgerRow } from "@/lib/ledger/rules";

describe("AI-3 drift guard", () => {
  const items = [
    { id: "a", type: "copy" },
    { id: "b", type: "visual" },
    { id: "c", type: "layout" },
  ];
  it("one result per item; unknown ids dropped; missing ones need a human", () => {
    const out = sanitizeDrift(
      { results: [{ item_id: "a", verdict: "done", note: "CTA now says Shop now" }, { item_id: "zzz", verdict: "done", note: "" }] },
      items,
      true,
    );
    expect(out.map((r) => [r.itemId, r.verdict])).toEqual([
      ["a", "done"],
      ["b", "needs_check"],
      ["c", "needs_check"],
    ]);
  });
  it("without both images, visual/layout verdicts become needs_check", () => {
    const out = sanitizeDrift(
      { results: [{ item_id: "b", verdict: "done", note: "" }, { item_id: "c", verdict: "missing", note: "" }, { item_id: "a", verdict: "missing", note: "" }] },
      items,
      false,
    );
    expect(out.map((r) => r.verdict)).toEqual(["missing", "needs_check", "needs_check"]);
  });
  it("AI unavailable: everything needs a human check", () => {
    expect(sanitizeDrift(null, items, true).every((r) => r.verdict === "needs_check" && r.note.includes("AI check unavailable"))).toBe(true);
  });
  it("schema rejects unknown verdicts", () => {
    expect(driftSchema.safeParse({ results: [{ item_id: "a", verdict: "partly", note: "" }] }).success).toBe(false);
  });
});

describe("drift rules", () => {
  const it0 = (p: Partial<ItemForCheck>): ItemForCheck => ({ id: "x", version_id: "v1", text: "t", type: "copy", status: "confirmed", created_at: "2026-11-21T10:00:00Z", ...p });
  it("checks confirmed items of the last sent version plus earlier open ones, once each", () => {
    const picked = itemsToCheck(
      [
        it0({ id: "1", text: "Change CTA to Shop now" }),
        it0({ id: "2", text: "change cta to  shop now", created_at: "2026-11-21T11:00:00Z" }), // duplicate (summarised twice)
        it0({ id: "3", status: "suggested" }),
        it0({ id: "4", status: "rejected" }),
        it0({ id: "5", type: "question", text: "Which font?" }),
        it0({ id: "6", version_id: "v0", status: "missing", text: "Logo bigger" }),
        it0({ id: "7", version_id: "v0", status: "done", text: "Old done" }),
      ],
      "v1",
    );
    expect(picked.map((p) => p.id).sort()).toEqual(["2", "6"]);
  });
  it("counts, button label and the creative's note", () => {
    const rs = [
      { verdict: "done", text: "CTA", note: "" },
      { verdict: "missing", text: "Logo bigger", note: "same size as v1" },
    ];
    expect(driftCounts(rs)).toEqual({ done: 1, missing: 1, reversed: 0, needs_check: 0 });
    expect(sendLabel(rs, 2)).toBe("Send to client anyway");
    expect(sendLabel([{ verdict: "done" }], 2)).toBe("Send v2 to client");
    const note = backToCreativeText("Diwali post", 2, rs);
    expect(note).toContain("[missing] Logo bigger (same size as v1)");
    expect(note).not.toContain("CTA");
    expect(note).toContain("Upload v3");
  });
  it("clients can't act while a version is held", () => {
    expect(canAct("approve", { isCurrent: false, deliverableStatus: "draft" })).toMatchObject({ ok: false, reason: expect.stringContaining("preparing") });
  });
});

const row = (p: Partial<LedgerRow>): LedgerRow => ({
  approvalId: "ap",
  deliverableId: "11111111-1111-1111-1111-111111111111",
  deliverable: "Diwali post",
  version: 3,
  versionId: "ver",
  approverId: "priya",
  approver: "Priya",
  approvedAt: "2026-11-21T19:00:00Z", // 22 Nov 00:30 IST
  copy: "Shop the sale",
  assetSha256: "abc",
  ...p,
});

describe("ledger", () => {
  it("CSV cells are quoted and can't run as formulas", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+91 98")).toBe('"\'+91 98"');
    expect(csvCell("-20% off")).toBe('"\'-20% off"');
  });
  it("CSV has BOM, header and CRLF rows with IST and UTC times", () => {
    const csv = toCsv([row({ copy: "दिवाली\nsale" })]);
    expect(csv.startsWith("﻿\"Deliverable\"")).toBe(true);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"2026-11-22 00:30"');
    expect(lines[1]).toContain('"2026-11-21T19:00:00Z"');
    expect(lines[1]).toContain("दिवाली\nsale");
  });
  it("filters by deliverable, approver, India calendar day and text", () => {
    const rows = [row({}), row({ approvalId: "b", approverId: "rahul", approver: "Rahul", approvedAt: "2026-11-20T08:00:00Z", copy: "Logo" })];
    expect(istDay("2026-11-21T19:00:00Z")).toBe("2026-11-22");
    expect(filterLedger(rows, { approver: "rahul" }).map((r) => r.approvalId)).toEqual(["b"]);
    expect(filterLedger(rows, { from: "2026-11-22" }).map((r) => r.approvalId)).toEqual(["ap"]);
    expect(filterLedger(rows, { to: "2026-11-21" }).map((r) => r.approvalId)).toEqual(["b"]);
    expect(filterLedger(rows, { q: "SALE" }).map((r) => r.approvalId)).toEqual(["ap"]);
  });
  it("parses only valid filters and round-trips them for the CSV link", () => {
    const f = parseFilter(new URLSearchParams("deliverable=nope&from=2026-11-01&to=bad&q=%20logo%20&approver=priya"));
    expect(f).toEqual({ from: "2026-11-01", q: "logo", approver: "priya" });
    expect(parseFilter(new URLSearchParams(filterQuery(f).slice(1)))).toEqual(f);
  });
});

describe("dashboard", () => {
  it("who's waiting", () => {
    expect(waitingOn({ status: "in_review", openConflicts: 0 })).toBe("client");
    expect(waitingOn({ status: "changes_requested", openConflicts: 1 })).toBe("client");
    expect(waitingOn({ status: "changes_requested", openConflicts: 0 })).toBe("team");
    expect(waitingOn({ status: "draft", openConflicts: 0 })).toBe("team");
    expect(waitingOn({ status: "approved", openConflicts: 0 })).toBe("none");
  });
  it("counts statuses, open items (not for approved work) and rounds over the limit", () => {
    const d = buildDashboard(
      [
        { id: "a", title: "A", status: "in_review", currentVersion: 3, sentVersions: 3, openConflicts: 0 },
        { id: "b", title: "B", status: "approved", currentVersion: 1, sentVersions: 1, openConflicts: 0 },
        { id: "c", title: "C", status: "draft", currentVersion: 2, sentVersions: 1, openConflicts: 0 },
      ],
      [
        { deliverableId: "a", status: "confirmed" },
        { deliverableId: "a", status: "done" },
        { deliverableId: "a", status: "rejected" },
        { deliverableId: "b", status: "confirmed" },
        { deliverableId: "c", status: "missing" },
      ],
      1,
    );
    expect(d.byStatus).toEqual({ draft: 1, in_review: 1, changes_requested: 0, approved: 1 });
    expect(d.openItems).toBe(2);
    expect(d.waiting).toEqual({ client: 1, team: 1 });
    expect(d.rows.find((r) => r.id === "a")).toMatchObject({ rounds: 2, overLimit: true });
    expect(d.overLimit).toBe(1);
  });
});
