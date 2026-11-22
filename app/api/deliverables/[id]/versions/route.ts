import { after } from "next/server";
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
import { createVersionAlert, driftItems, lastSentVersion, runDriftCheck, supersedeOpenAlerts } from "@/lib/drift/check";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { runJob } from "@/lib/jobs";

export const maxDuration = 60; // the AI-3 drift check runs after the response

const body = z.object({
  copy: z.string().max(5000).default(""),
  assetPath: z.string().max(200),
});

/**
 * POST /api/deliverables/:id/versions: uploads vN+1 (FR-10). Owner, AM or creative.
 * - Confirmed changes exist for the last version the client saw → the version is held
 *   (status draft, nothing in the client room) and AI-3 runs the drift check (FR-11).
 * - Otherwise → posts the new card and marks the previous card "Superseded" in place.
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
    const limited = await rateLimit(req, "versions", LIMITS.ai, res.access.userId);
    if (limited) return limited;
    const access = res.access;
    if (access.kind !== "member" || !canUploadVersions(access.role)) {
      return jsonError(403, "Only your agency team can upload new versions.");
    }
    if (d.status === "approved") return jsonError(409, "This deliverable is already approved.");

    const asset = await inspectUpload(d.project_id, input.assetPath);
    const lastSent = (await lastSentVersion(d.id)) ?? (await getVersionByNumber(d.id, d.current_version));
    const toCheck = lastSent ? await driftItems(d.id, lastSent) : [];
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
    await supersedeOpenAlerts(access.project, d.id);

    if (lastSent && toCheck.length > 0) {
      await updateDeliverable(d.id, { current_version: next.number, status: "draft" });
      const alert = await createVersionAlert(d, lastSent, v, toCheck);
      const project = access.project;
      after(() => runJob("drift-check", { alertId: alert.id }, () => runDriftCheck(project, d, alert, lastSent, v, toCheck)));
      return ok({ versionId: v.id, version: next.number, held: true, checking: toCheck.length, alertId: alert.id }, 201);
    }

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
      lastSent ? setCardStatus(access.project, lastSent, "superseded").catch(() => {}) : Promise.resolve(),
    ]);
    return ok({ versionId: v.id, version: next.number, held: false }, 201);
  } catch (err) {
    if (err instanceof UploadError) return jsonError(400, err.message);
    return handleRouteError("deliverables/versions", err);
  }
}
