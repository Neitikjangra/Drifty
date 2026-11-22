import "server-only";
import { createGroupChannel, issueAccessToken, joinGroupChannel, leaveGroupChannel, sendGroupMessage } from "./api";
import { BOT_NAME, BOT_USER_ID } from "./ids";

/** Channel ids: "c"/"i" + project uuid without dashes (33 chars, alphanumeric). */
export function roomIds(projectId: string): { client: string; internal: string } {
  const hex = projectId.replace(/-/g, "");
  return { client: `c${hex}`, internal: `i${hex}` };
}

let botReady: Promise<void> | null = null;
/** Issuing a token registers the bot user in Nexconn; once per server instance is enough. */
export function ensureBot(): Promise<void> {
  botReady ??= issueAccessToken(BOT_USER_ID, BOT_NAME).then(
    () => undefined,
    (err) => {
      botReady = null;
      throw err;
    },
  );
  return botReady;
}

async function botSays(channelId: string, text: string) {
  await sendGroupMessage({
    fromUserId: BOT_USER_ID,
    channelId,
    messageType: "RC:TxtMsg",
    content: { content: text },
  });
}

/**
 * Creates the client room and the internal room for a project, with the Drifty AI
 * bot as owner (FR-2), and posts a short welcome so neither room starts empty.
 */
export async function createProjectRooms(input: {
  projectId: string;
  clientName: string;
  clientRoomMembers: string[];
  internalRoomMembers: string[];
}): Promise<{ client: string; internal: string }> {
  await ensureBot();
  const ids = roomIds(input.projectId);
  await createGroupChannel(ids.client, `${input.clientName} · client room`, BOT_USER_ID, input.clientRoomMembers);
  await createGroupChannel(ids.internal, `${input.clientName} · internal`, BOT_USER_ID, input.internalRoomMembers);
  await botSays(
    ids.client,
    `Welcome to the ${input.clientName} room. Share feedback here as text or voice notes, in English, Hindi or Hinglish; drafts will appear as cards you can approve.`,
  );
  await botSays(
    ids.internal,
    `Internal room for ${input.clientName}. Clients can't see this room.`,
  );
  return ids;
}

export async function addToRoom(channelId: string, nexconnUserIds: string[]) {
  if (nexconnUserIds.length) await joinGroupChannel(channelId, nexconnUserIds);
}

export async function removeFromRoom(channelId: string, nexconnUserIds: string[]) {
  if (nexconnUserIds.length) await leaveGroupChannel(channelId, nexconnUserIds);
}
