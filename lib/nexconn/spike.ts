import "server-only";
import {
  createGroupChannel,
  issueAccessToken,
  joinGroupChannel,
  NexconnApiError,
} from "./api";
import { BOT_NAME, BOT_USER_ID } from "./ids";

/** Round 0 spike only: two fixed test users in one fixed test group channel. */
export const SPIKE_CHANNEL_ID = "driftyspike01";
export const SPIKE_USERS = {
  alice: { userId: "spikealice", name: "Alice (agency)" },
  bob: { userId: "spikebob", name: "Bob (client)" },
} as const;
export type SpikeUser = keyof typeof SPIKE_USERS;

let channelReady: Promise<void> | null = null;

/** Makes sure the bot and both test users exist and are in the spike channel. */
export function ensureSpikeChannel(): Promise<void> {
  channelReady ??= (async () => {
    // Issuing a token registers the user in Nexconn.
    await issueAccessToken(BOT_USER_ID, BOT_NAME);
    const members = Object.values(SPIKE_USERS).map((u) => u.userId);
    try {
      await createGroupChannel(SPIKE_CHANNEL_ID, "Drifty spike room", BOT_USER_ID, members);
    } catch (err) {
      // Already exists (e.g. after a cold start): fall through to join, which is idempotent.
      if (!(err instanceof NexconnApiError) || err.httpStatus >= 500) throw err;
    }
    await joinGroupChannel(SPIKE_CHANNEL_ID, members);
  })().catch((err) => {
    channelReady = null;
    throw err;
  });
  return channelReady;
}
