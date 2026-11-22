import { after } from "next/server";
import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { deleteDeliverable, insertDeliverable, insertVersion, setVersionCard } from "@/lib/db/deliverables";
import { postDeliverableCard } from "@/lib/deliverables/cards-server";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { inspectUpload, UploadError } from "@/lib/storage";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { notifyNewVersion } from "@/lib/push/send";

const body = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  copy: z.string().max(5000).default(""),
  dueDate: z.iso.date().nullable().optional(),
  assetPath: z.string().max(200),
});

/**
 * POST /api/deliverables: creates a deliverable + version 1 from an uploaded file and posts
 * its `drifty:deliverable` card in the client room (FR-4). Owner/AM only.
 */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Add a title and a file.");
  try {
    const res = await routeProjectAccess(input.projectId);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Project not found.");
    const limited = await rateLimit(req, "deliverables", LIMITS.upload, res.access.userId);
    if (limited) return limited;
    const access = res.access;
    if (access.kind !== "member" || !canManageProjects(access.role)) {
      return jsonError(403, "Only owners and account managers can post deliverables.");
    }
    if (!access.project.client_channel_id) return jsonError(409, "This project's client room isn't ready.");

    const asset = await inspectUpload(input.projectId, input.assetPath);
    const d = await insertDeliverable({ project_id: input.projectId, title: input.title, due_date: input.dueDate ?? null });
    try {
      const v = await insertVersion({
        deliverable_id: d.id,
        number: 1,
        asset_path: input.assetPath,
        asset_sha256: asset.sha256,
        asset_mime: asset.mime,
        copy_text: input.copy,
        created_by: access.userId,
      });
      const messageId = await postDeliverableCard(access.project, d, v);
      await setVersionCard(v.id, messageId);
      const project = access.project;
      after(() => notifyNewVersion(project, d.title, 1).catch(() => {}));
      return ok({ id: d.id, versionId: v.id }, 201);
    } catch (err) {
      await deleteDeliverable(d.id).catch(() => {});
      throw err;
    }
  } catch (err) {
    if (err instanceof UploadError) return jsonError(400, err.message);
    return handleRouteError("deliverables", err);
  }
}
