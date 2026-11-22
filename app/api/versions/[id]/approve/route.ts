import { after } from "next/server";
import { insertApproval, transitionDeliverable, updateDeliverable } from "@/lib/db/deliverables";
import { approverContext } from "@/lib/deliverables/approver";
import { postReceipt, setCardStatus } from "@/lib/deliverables/cards-server";
import { canAct } from "@/lib/deliverables/rules";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/versions/:id/approve: approver only, verified on the server (FR-5).
 * Writes the insert-only approval row with the exact copy and asset hash (FR-13), turns
 * the card green for everyone through message metadata (FR-6) and posts a receipt.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/versions/[id]/approve">) {
  const { id } = await ctx.params;
  try {
    const c = await approverContext(id);
    if (!c.ok) return jsonError(c.status, c.error);
    const { v, d, access } = c;
    const limited = await rateLimit(req, "approve", LIMITS.write, access.userId);
    if (limited) return limited;
    const allowed = canAct("approve", { isCurrent: d.current_version === v.number, deliverableStatus: d.status });
    if (!allowed.ok) return jsonError(409, allowed.reason);

    // Atomic status move first, so a double tap can't create two approvals.
    if (!(await transitionDeliverable(d.id, v.number, ["in_review", "changes_requested", "draft"], "approved"))) {
      return jsonError(409, "This version was just updated. Refresh and try again.");
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
    return ok({ approvalId: approval.id, approvedAt, status: "approved", actedBy: name });
  } catch (err) {
    return handleRouteError("versions/approve", err);
  }
}
