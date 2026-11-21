import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canUploadVersions } from "@/lib/auth/permissions";
import {
  deleteVersion,
  getDeliverable,
  getVersionByNumber,
  insertVersion,
  setVersionCard,
  updateDeliverable,
} from "@/lib/db/deliverables";
import { postDeliverableCard, setCardStatus } from "@/lib/deliverables/cards-server";
import { nextVersion } from "@/lib/deliverables/rules";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { inspectUpload, UploadError } from "@/lib/storage";

const body = z.object({
  copy: z.string().max(5000).default(""),
  assetPath: z.string().max(200),
});

/**
 * POST /api/deliverables/:id/versions: uploads vN+1 (FR-10). Posts the new card and marks
 * the previous card "Superseded" in place. Owner, AM or creative.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/deliverables/[id]/versions">) {
  const { id } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Add a file.");
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Deliverable not found.");
  try {
    const d = await getDeliverable(id);
    if (!d) return jsonError(404, "Deliverable not found.");
    const res = await routeProjectAccess(d.project_id);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Deliverable not found.");
    const access = res.access;
    if (access.kind !== "member" || !canUploadVersions(access.role)) {
      return jsonError(403, "Only your agency team can upload new versions.");
    }
    if (d.status === "approved") return jsonError(409, "This deliverable is already approved.");

    const asset = await inspectUpload(d.project_id, input.assetPath);
    const previous = await getVersionByNumber(d.id, d.current_version);
    const next = nextVersion(d.current_version);
    const v = await insertVersion({
      deliverable_id: d.id,
      number: next.number,
      asset_path: input.assetPath,
      asset_sha256: asset.sha256,
      asset_mime: asset.mime,
      copy_text: input.copy,
      created_by: access.userId,
    });
    let messageId: string;
    try {
      messageId = await postDeliverableCard(access.project, d, v);
    } catch (err) {
      await deleteVersion(v.id).catch(() => {});
      throw err;
    }
    await Promise.all([
      setVersionCard(v.id, messageId),
      updateDeliverable(d.id, { current_version: next.number, status: next.status }),
      previous ? setCardStatus(access.project, previous, "superseded").catch(() => {}) : Promise.resolve(),
    ]);
    return ok({ versionId: v.id, version: next.number }, 201);
  } catch (err) {
    if (err instanceof UploadError) return jsonError(400, err.message);
    return handleRouteError("deliverables/versions", err);
  }
}
