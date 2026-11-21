/**
 * Nexconn user and channel IDs allow only letters and digits, max 64 chars.
 * We derive them from our own UUIDs so they are stable and never contain PII.
 */
const ALNUM = /^[A-Za-z0-9]{1,64}$/;

export function isValidNexconnId(id: string): boolean {
  return ALNUM.test(id);
}

/** "u" + uuid without dashes = 33 chars. */
export function nexconnUserId(appUserId: string): string {
  const id = `u${appUserId.replace(/-/g, "")}`;
  if (!isValidNexconnId(id)) throw new Error("Invalid app user id for Nexconn");
  return id;
}

/** The Drifty AI bot posts cards and updates status. One bot per app. */
export const BOT_USER_ID = "driftybot";
export const BOT_NAME = "Drifty AI";

/** Custom message types. Must be <= 32 chars and must not start with RC: / NC:. */
export const MSG = {
  deliverable: "drifty:deliverable",
  receipt: "drifty:receipt",
  changelist: "drifty:changelist",
  conflict: "drifty:conflict",
  drift: "drifty:drift",
} as const;
