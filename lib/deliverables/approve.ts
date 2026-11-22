import "server-only";
import { after } from "next/server";
import type { ProjectAccess } from "@/lib/access";
import { insertApproval, transitionDeliverable, updateDeliverable, type Deliverable, type Version } from "@/lib/db/deliverables";
import { postReceipt, setCardStatus } from "./cards-server";
import { canAct } from "./rules";
import { notifyDecision } from "@/lib/push/send";

export type ApproveResult = { ok: true; approvalId: string; approvedAt: string; actedBy: string } | { ok: false; status: 409; error: string };

/**
 * The one approval path (FR-5, FR-13): the caller must already be verified as the project's
 * approver (approverContext). Moves the status atomically, writes the insert-only ledger row
 * with the exact copy and asset hash, turns the card green and posts the receipt.
 * Used by the card's Approve button and by the "Does this approve all of vX?" check (FR-16).
 */
export async function approveVersion(v: Version, d: Deliverable, access: ProjectAccess & { kind: "guest" }): Promise<ApproveResult> {
  const allowed = canAct("approve", { isCurrent: d.current_version === v.number, deliverableStatus: d.status });
  if (!allowed.ok) return { ok: false, status: 409, error: allowed.reason };
  // Atomic status move first, so a double tap can't create two approvals.
  if (!(await transitionDeliverable(d.id, v.number, ["in_review", "changes_requested"], "approved"))) {
    return { ok: false, status: 409, error: "This version was just updated. Refresh and try again." };
  }
  let approval;
  try {
    approval = await insertApproval({
      version_id: v.id,
      approver_id: access.userId,
      approved_at: new Date().toISOString(),
      copy_snapshot: v.copy_text,
      asset_sha256: v.asset_sha256,
    });
  } catch (err) {
    // Never leave "approved" without its ledger row.
    await updateDeliverable(d.id, { status: d.status }).catch(() => {});
    throw err;
  }
  const name = access.profile?.display_name ?? "Approver";
  await setCardStatus(access.project, v, "approved", name);
  const approvedAt = approval.approved_at;
  // The receipt doesn't need to block the approver's tap.
  after(() => postReceipt(access.project, d, v, name, approvedAt).catch(() => {}));
  after(() => notifyDecision(access.project, "approved", { userId: access.userId, name }, d.title, v.number).catch(() => {}));
  return { ok: true, approvalId: approval.id, approvedAt, actedBy: name };
}
