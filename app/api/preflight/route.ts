import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canUploadVersions } from "@/lib/auth/permissions";
import { getDeliverable } from "@/lib/db/deliverables";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { runPreflight } from "@/lib/preflight/run";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { inspectUpload, UploadError } from "@/lib/storage";

const body = z.object({
  projectId: z.uuid(),
  /** Set for a new version of an existing deliverable; absent for a brand-new deliverable. */
  deliverableId: z.uuid().optional(),
  title: z.string().trim().max(120).optional(),
  brief: z.string().trim().max(2000).optional(),
  copy: z.string().max(5000).default(""),
  assetPath: z.string().min(1).max(300),
});

/**
 * POST /api/preflight: AI-4 pre-flight check on an uploaded draft before it is posted.
 * Team members who can upload only; results stay with the team (never posted to the client).
 */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Invalid request.");
  try {
    const res = await routeProjectAccess(input.projectId);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Project not found.");
    const access = res.access;
    if (access.kind !== "member" || !canUploadVersions(access.role)) return jsonError(403, "Only your team can run a pre-flight check.");
    const limited = await rateLimit(req, "preflight", LIMITS.ai, access.userId);
    if (limited) return limited;

    let title = input.title ?? "";
    let brief = input.brief ?? "";
    let version = 1;
    if (input.deliverableId) {
      const d = await getDeliverable(input.deliverableId);
      if (!d || d.project_id !== access.project.id) return jsonError(404, "Deliverable not found.");
      const { data } = await supabaseAdmin().from("deliverables").select("brief").eq("id", d.id).maybeSingle();
      title = d.title;
      brief = (data as { brief: string } | null)?.brief ?? "";
      version = d.current_version + 1;
    }
    if (!title) return jsonError(400, "Give the deliverable a title first.");

    const asset = await inspectUpload(access.project.id, input.assetPath);
    const result = await runPreflight({
      project: access.project,
      runBy: access.userId,
      title,
      version,
      copy: input.copy,
      brief,
      deliverableId: input.deliverableId ?? null,
      asset: { path: input.assetPath, mime: asset.mime, sha256: asset.sha256 },
    });
    return ok(result);
  } catch (err) {
    if (err instanceof UploadError) return jsonError(400, err.message);
    return handleRouteError("preflight", err);
  }
}
