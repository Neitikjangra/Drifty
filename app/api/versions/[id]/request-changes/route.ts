import { after } from "next/server";
import { z } from "zod";
import { transitionDeliverable } from "@/lib/db/deliverables";
import { approverContext } from "@/lib/deliverables/approver";
import { postTextAs, setCardStatus } from "@/lib/deliverables/cards-server";
import { canAct } from "@/lib/deliverables/rules";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";

const body = z.object({ note: z.string().trim().max(2000).optional() });

/**
 * POST /api/versions/:id/request-changes: approver only (FR-5). Card shows
 * "Changes requested" for everyone (FR-6). An optional note is posted in the room as the
 * approver's own message, so it becomes feedback for the change list (Round 3).
 */
export async function POST(req: Request, ctx: RouteContext<"/api/versions/[id]/request-changes">) {
  const { id } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Invalid request.");
  try {
    const c = await approverContext(id);
    if (!c.ok) return jsonError(c.status, c.error);
    const { v, d, access } = c;
    const allowed = canAct("request_changes", { isCurrent: d.current_version === v.number, deliverableStatus: d.status });
    if (!allowed.ok) return jsonError(409, allowed.reason);
    if (!(await transitionDeliverable(d.id, v.number, ["in_review", "draft"], "changes_requested"))) {
      return jsonError(409, "This version was just updated. Refresh and try again.");
    }
    const name = access.profile?.display_name ?? "Approver";
    await setCardStatus(access.project, v, "changes_requested", name);
    const note = input.note;
    const profile = access.profile;
    if (note && profile) {
      // Don't make the approver wait for the note message.
      after(() =>
        postTextAs(access.project, profile.nexconn_user_id, `Changes for ${d.title} v${v.number}: ${note}`).catch(() => {}),
      );
    }
    return ok({ status: "changes_requested", actedBy: name });
  } catch (err) {
    return handleRouteError("versions/request-changes", err);
  }
}
