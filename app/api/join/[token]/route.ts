import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAgencyUser, getGuestId, setGuestCookie } from "@/lib/auth/session";
import { addGuest, claimInvite, getProfile, releaseInvite, setInviteUsedBy, upsertProfile } from "@/lib/db/repo";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { resolveInvite } from "@/lib/invites";
import { issueAccessToken } from "@/lib/nexconn/api";
import { nexconnUserId } from "@/lib/nexconn/ids";
import { addToRoom } from "@/lib/nexconn/rooms";

const body = z.object({ name: z.string().trim().min(1).max(64) });

const MESSAGES = {
  invalid: "This invite link isn't valid.",
  expired: "This invite link has expired. Ask your agency for a new one.",
  revoked: "This invite link was cancelled. Ask your agency for a new one.",
  used: "This invite link was already used. Ask your agency for a new one.",
} as const;

/**
 * POST /api/join/:token: accepts a client invite (FR-3, NFR-3). The guest gets a
 * Nexconn user and joins ONLY the project's client room, never the internal room.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/join/[token]">) {
  const { token } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Enter your name.");
  try {
    if (await getAgencyUser()) {
      return jsonError(409, "You're signed in as an agency user. Open this link in a private window or on the client's device.");
    }
    const resolved = await resolveInvite(token);
    if (resolved.state !== "ok") return jsonError(410, MESSAGES[resolved.state]);
    const { invite, project } = resolved;

    // Reuse the guest identity already on this device, if any.
    const existingId = await getGuestId();
    const existing = existingId ? await getProfile(existingId) : null;
    const guestId = existing?.user_id ?? randomUUID();
    const nexconnId = existing?.nexconn_user_id ?? nexconnUserId(guestId);

    // Claim first so two people can't use one link at the same time.
    if (!(await claimInvite(invite.id))) return jsonError(410, MESSAGES.used);

    try {
      await upsertProfile({
        user_id: guestId,
        display_name: input.name,
        email: invite.email_or_phone.includes("@") ? invite.email_or_phone : (existing?.email ?? null),
        nexconn_user_id: nexconnId,
      });
      await setInviteUsedBy(invite.id, guestId);
      await addGuest(project.id, guestId, invite.role);
      await issueAccessToken(nexconnId, input.name);
      await addToRoom(project.client_channel_id!, [nexconnId]);
    } catch (err) {
      // Give the link back so the client can simply try again.
      await releaseInvite(invite.id).catch(() => {});
      throw err;
    }
    await setGuestCookie(guestId);
    return ok({ projectId: project.id });
  } catch (err) {
    return handleRouteError("join", err);
  }
}
