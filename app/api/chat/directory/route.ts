import { isOnProject } from "@/lib/team/server";
import { z } from "zod";
import { getCaller } from "@/lib/access";
import { getGuestRole, getProfilesByNexconnIds, projectsByChannelIds, roomMembers } from "@/lib/db/repo";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { BOT_NAME, BOT_USER_ID, isValidNexconnId } from "@/lib/nexconn/ids";

const id = z.string().refine(isValidNexconnId);
// Unknown or malformed ids are dropped rather than failing the whole lookup.
const ids = (max: number) =>
  z
    .array(z.string())
    .max(max)
    .default([])
    .transform((list) => list.filter(isValidNexconnId));
const body = z.object({
  userIds: ids(200),
  groupIds: ids(100),
  membersOf: id.optional(),
});

/**
 * POST /api/chat/directory: display names for ChatUI's ServiceHooks.
 * Only returns rooms the caller can enter, and people's names (never emails).
 */
export async function POST(req: Request) {
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Invalid request.");
  try {
    const caller = await getCaller();
    if (caller.kind === "anonymous") return jsonError(401, "Please sign in.");

    const projects = await projectsByChannelIds(
      input.membersOf ? [...input.groupIds, input.membersOf] : input.groupIds,
    );
    // Every lookup below is independent: run them in parallel (this route gates the chat header).
    const perProject = await Promise.all(
      projects.map(async (p) => {
        const out: { groupId: string; name: string; memberCount?: number }[] = [];
        const sameWorkspace = caller.kind === "member" && caller.membership?.workspace.id === p.workspace_id;
        const role = caller.kind === "member" ? caller.membership?.role : undefined;
        const canClient = caller.kind === "member" ? sameWorkspace && role !== "creative" : Boolean(await getGuestRole(p.id, caller.userId));
        const canInternal = sameWorkspace && (role !== "creative" || (await isOnProject(p.id, caller.userId)));
        const [clientN, internalN] = await Promise.all([
          canClient && p.client_channel_id ? roomMembers(p.id, p.workspace_id, true).then((m) => m.length) : Promise.resolve(-1),
          canInternal && p.internal_channel_id ? roomMembers(p.id, p.workspace_id, false).then((m) => m.length) : Promise.resolve(-1),
        ]);
        // +1 for the Drifty AI bot, which is in every room.
        if (clientN >= 0) out.push({ groupId: p.client_channel_id!, name: p.client_name, memberCount: clientN + 1 });
        if (internalN >= 0) out.push({ groupId: p.internal_channel_id!, name: `${p.client_name} · internal`, memberCount: internalN + 1 });
        return out;
      }),
    );
    const groups = perProject.flat();

    const profiles = await getProfilesByNexconnIds(input.userIds.filter((u) => u !== BOT_USER_ID));
    const users = profiles.map((p) => ({ userId: p.nexconn_user_id, name: p.display_name }));
    if (input.userIds.includes(BOT_USER_ID)) users.push({ userId: BOT_USER_ID, name: BOT_NAME });

    // Room members (for @mentions), only for a room the caller may enter.
    let members: { userId: string; name: string }[] | undefined;
    if (input.membersOf && groups.some((g) => g.groupId === input.membersOf)) {
      const p = projects.find((x) => x.client_channel_id === input.membersOf || x.internal_channel_id === input.membersOf)!;
      const isClientRoom = p.client_channel_id === input.membersOf;
      members = [
        { userId: BOT_USER_ID, name: BOT_NAME },
        ...(await roomMembers(p.id, p.workspace_id, isClientRoom)),
      ];
    }

    return ok({ users, groups, members });
  } catch (err) {
    return handleRouteError("chat/directory", err);
  }
}
