import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canUploadVersions } from "@/lib/auth/permissions";
import { validateUploadRequest, type AllowedMime } from "@/lib/deliverables/rules";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { createUploadSlot, UploadError } from "@/lib/storage";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

const body = z.object({
  projectId: z.uuid(),
  contentType: z.string().max(100),
  size: z.number().int(),
});

/**
 * POST /api/uploads: a one-time signed upload slot in the private bucket. The browser
 * uploads straight to Storage; the file is checked again (type, size, hash) when it is
 * attached to a deliverable. Agency members only (owner, AM, creative).
 */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Invalid upload request.");
  const invalid = validateUploadRequest(input.contentType, input.size);
  if (invalid) return jsonError(400, invalid);
  try {
    const res = await routeProjectAccess(input.projectId);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Project not found.");
    const limited = await rateLimit(req, "upload", LIMITS.upload, res.access.userId);
    if (limited) return limited;
    if (res.access.kind !== "member" || !canUploadVersions(res.access.role)) {
      return jsonError(403, "Only your agency team can upload drafts.");
    }
    const slot = await createUploadSlot(input.projectId, input.contentType as AllowedMime);
    return ok(slot, 201);
  } catch (err) {
    if (err instanceof UploadError) return jsonError(400, err.message);
    return handleRouteError("uploads", err);
  }
}
