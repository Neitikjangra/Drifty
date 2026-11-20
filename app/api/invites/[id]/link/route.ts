import { handleRouteError, jsonError, ok } from "@/lib/http";
import { manageableInvite } from "@/lib/invite-admin";
import { inviteLink } from "@/lib/invites";
import { inviteState } from "@/lib/auth/tokens";

const STATUS_MSG = { 401: "Please sign in first.", 403: "Only owners and account managers can do this.", 404: "Invite not found." };

/** GET /api/invites/:id/link: the same personal link again, for "Copy link again". Owner/AM only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/invites/[id]/link">) {
  const { id } = await ctx.params;
  try {
    const res = await manageableInvite(id);
    if (!res.ok) return jsonError(res.status, STATUS_MSG[res.status]);
    const state = inviteState(res.invite);
    if (state !== "ok") return jsonError(409, `This link has ${state === "revoked" ? "been cancelled" : "expired"}. Create a new one.`, { needsNewLink: true });
    const link = await inviteLink(id);
    if (!link) return jsonError(409, "This older link can't be shown again. Create a new one.", { needsNewLink: true });
    return ok({ link, expiresAt: res.invite.expires_at });
  } catch (err) {
    return handleRouteError("invites/link", err);
  }
}
