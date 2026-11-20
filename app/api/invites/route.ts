import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { createInvite } from "@/lib/invite-admin";

const body = z.object({
  projectId: z.uuid(),
  emailOrPhone: z.string().trim().min(3).max(120),
  name: z.string().trim().min(1).max(64),
  role: z.enum(["approver", "reviewer"]),
});

/**
 * POST /api/invites: creates a personal client invite link (FR-3). Reusable by that one
 * person on any device for 30 days, revocable. Only its keyed hash is stored.
 */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Add the client's name and email or phone.");
  try {
    const res = await routeProjectAccess(input.projectId);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Project not found.");
    const access = res.access;
    if (access.kind !== "member" || !canManageProjects(access.role)) {
      return jsonError(403, "Only owners and account managers can invite clients.");
    }
    const { invite, link } = await createInvite({
      projectId: input.projectId,
      emailOrPhone: input.emailOrPhone,
      name: input.name,
      role: input.role,
      createdBy: access.userId,
    });
    return ok({ id: invite.id, link, expiresAt: invite.expires_at }, 201);
  } catch (err) {
    return handleRouteError("invites", err);
  }
}
