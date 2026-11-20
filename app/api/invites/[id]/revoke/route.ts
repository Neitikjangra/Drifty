import { activeInvitesForGuest, getProfile, removeGuest, revokeInvite } from "@/lib/db/repo";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { manageableInvite } from "@/lib/invite-admin";
import { removeFromRoom } from "@/lib/nexconn/rooms";

const STATUS_MSG = { 401: "Please sign in first.", 403: "Only owners and account managers can do this.", 404: "Invite not found." };

/**
 * POST /api/invites/:id/revoke: the link stops working (NFR-5). If the person already
 * joined and has no other active link for this project, they also lose access to the
 * client room (removed from the Nexconn channel and project_guests). Owner/AM only.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/invites/[id]/revoke">) {
  const { id } = await ctx.params;
  try {
    const res = await manageableInvite(id);
    if (!res.ok) return jsonError(res.status, STATUS_MSG[res.status]);
    const { invite, access } = res;
    await revokeInvite(invite.id);

    let removed = false;
    if (invite.used_by) {
      const stillActive = await activeInvitesForGuest(invite.project_id, invite.used_by);
      if (stillActive.length === 0) {
        const profile = await getProfile(invite.used_by);
        await removeGuest(invite.project_id, invite.used_by);
        if (profile && access.project.client_channel_id) {
          await removeFromRoom(access.project.client_channel_id, [profile.nexconn_user_id]);
        }
        removed = true;
      }
    }
    return ok({ removedFromRoom: removed });
  } catch (err) {
    return handleRouteError("invites/revoke", err);
  }
}
