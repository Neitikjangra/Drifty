/** Role rules (SRS section 3). Pure, so they're unit-tested; every route calls them server-side. */

export type MemberRole = "owner" | "am" | "creative";
export type GuestRole = "approver" | "reviewer";

/** Create projects, invite clients, set the approver. */
export function canManageProjects(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "am";
}

/** Agency roles that sit in the client room (creatives work in the internal room). */
export function joinsClientRoom(role: MemberRole): boolean {
  return role === "owner" || role === "am";
}

/** Which rooms a person may enter. Guests never get the internal room. */
export function allowedRooms(
  who: { kind: "member"; role: MemberRole } | { kind: "guest"; role: GuestRole },
): { client: boolean; internal: boolean } {
  if (who.kind === "guest") return { client: true, internal: false };
  return { client: joinsClientRoom(who.role), internal: true };
}
