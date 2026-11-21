/** Role rules (SRS section 3). Pure, so they're unit-tested; every route calls them server-side. */

export type MemberRole = "owner" | "am" | "creative";
export type GuestRole = "approver" | "reviewer";

/** Create projects, invite clients, set the approver. */
export function canManageProjects(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "am";
}

/** Upload new versions of a deliverable (FR-10): creatives too. */
export function canUploadVersions(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "am" || role === "creative";
}

/** Only the project's named approver may approve or request changes (FR-5). */
export function isProjectApprover(
  who: { kind: "member" | "guest"; role: string; userId: string },
  project: { approver_id: string | null },
): boolean {
  return who.kind === "guest" && who.role === "approver" && project.approver_id === who.userId;
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
