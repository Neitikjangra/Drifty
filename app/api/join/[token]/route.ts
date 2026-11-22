import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAgencyUser, getGuestId, setGuestCookie } from "@/lib/auth/session";
import { addGuest, getGuestRole, getProfile, markInviteUsed, upsertProfile } from "@/lib/db/repo";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { resolveInvite } from "@/lib/invites";
import { issueAccessToken } from "@/lib/nexconn/api";
import { nexconnUserId } from "@/lib/nexconn/ids";
import { addToRoom } from "@/lib/nexconn/rooms";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

// Name is only needed the first time; returning visits just continue.
const body = z.object({ name: z.string().trim().min(1).max(64).optional() });

const MESSAGES = {
  invalid: "This link isn't valid. Ask your agency for a new link.",
  expired: "This link has expired. Ask your agency for a new link.",
  revoked: "This link was cancelled. Ask your agency for a new link.",
} as const;

/**
 * POST /api/join/:token: opens the client room from a personal invite link (FR-3, NFR-3).
 * The link belongs to one person and works on any device until it expires (30 days) or
 * the AM cancels it. The guest joins ONLY the project's client room, never the internal room.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/join/[token]">) {
  const { token } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Enter your name.");
  try {
    const limited = await rateLimit(req, "join", LIMITS.join);
    if (limited) return limited;
    if (await getAgencyUser()) {
      return jsonError(409, "You're signed in as an agency user. Open this link in a private window or on the client's device.");
    }
    const resolved = await resolveInvite(token);
    if (resolved.state !== "ok") return jsonError(410, MESSAGES[resolved.state]);
    const { invite, project } = resolved;

    let guestId: string;
    let profile = invite.used_by ? await getProfile(invite.used_by) : null;
    if (profile) {
      // Returning: the link belongs to this person; sign them back in on this device.
      guestId = profile.user_id;
    } else {
      // First use: reuse this device's client identity (same person, other projects) or create one.
      if (!input.name) return jsonError(400, "Enter your name.");
      const deviceGuest = await getGuestId();
      const existing = deviceGuest ? await getProfile(deviceGuest) : null;
      guestId = existing?.user_id ?? randomUUID();
      profile = {
        user_id: guestId,
        display_name: existing?.display_name ?? input.name,
        email: invite.email_or_phone.includes("@") ? invite.email_or_phone : (existing?.email ?? null),
        nexconn_user_id: existing?.nexconn_user_id ?? nexconnUserId(guestId),
      };
      await upsertProfile(profile);
    }

    // Re-add if they were removed (e.g. link cancelled then re-issued); keep a changed role.
    if (!(await getGuestRole(project.id, guestId))) await addGuest(project.id, guestId, invite.role);
    await issueAccessToken(profile.nexconn_user_id, profile.display_name);
    await addToRoom(project.client_channel_id!, [profile.nexconn_user_id]);
    await markInviteUsed(invite, guestId);
    await setGuestCookie(guestId);
    return ok({ projectId: project.id });
  } catch (err) {
    return handleRouteError("join", err);
  }
}
