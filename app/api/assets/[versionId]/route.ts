import { NextResponse } from "next/server";
import { projectAccess, getCaller } from "@/lib/access";
import { getDeliverable, getVersion } from "@/lib/db/deliverables";
import { handleRouteError, jsonError } from "@/lib/http";
import { signedReadUrl } from "@/lib/storage";

/**
 * GET /api/assets/:versionId: the draft file for a card. Checks the viewer belongs to the
 * project (agency member or client of this project), then redirects to a short-lived
 * signed URL from the private bucket.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/assets/[versionId]">) {
  const { versionId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(versionId)) return jsonError(404, "Not found.");
  try {
    const caller = await getCaller();
    if (caller.kind === "anonymous") return jsonError(401, "Please sign in.");
    const v = await getVersion(versionId);
    const d = v ? await getDeliverable(v.deliverable_id) : null;
    if (!v || !d || !(await projectAccess(d.project_id, caller))) return jsonError(404, "Not found.");
    const url = await signedReadUrl(v.asset_path, 300);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=240" } });
  } catch (err) {
    return handleRouteError("assets", err);
  }
}
