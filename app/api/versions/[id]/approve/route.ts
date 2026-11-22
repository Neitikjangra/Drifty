import { approveVersion } from "@/lib/deliverables/approve";
import { approverContext } from "@/lib/deliverables/approver";
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
    const limited = await rateLimit(req, "approve", LIMITS.write, c.access.userId);
    if (limited) return limited;
    const r = await approveVersion(c.v, c.d, c.access);
    if (!r.ok) return jsonError(r.status, r.error);
    return ok({ approvalId: r.approvalId, approvedAt: r.approvedAt, status: "approved", actedBy: r.actedBy });
  } catch (err) {
    return handleRouteError("versions/approve", err);
  }
}
