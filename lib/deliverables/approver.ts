import "server-only";
import { getCaller, projectAccess, type ProjectAccess } from "@/lib/access";
import { isProjectApprover } from "@/lib/auth/permissions";
import { getDeliverable, getVersion, type Deliverable, type Version } from "@/lib/db/deliverables";

/**
 * Loads a version for an approver action and verifies, on the server, that the caller is
 * this project's named approver (FR-5). 401 signed out, 403 not the approver, 404 unknown.
 */
export async function approverContext(
  versionId: string,
): Promise<
  | { ok: true; v: Version; d: Deliverable; access: ProjectAccess & { kind: "guest" } }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  if (!/^[0-9a-f-]{36}$/.test(versionId)) return { ok: false, status: 404, error: "Version not found." };
  // Independent lookups in parallel: every round trip adds to the approver's wait.
  const [caller, v] = await Promise.all([getCaller(), getVersion(versionId)]);
  if (caller.kind === "anonymous") return { ok: false, status: 401, error: "Open your invite link again to sign in." };
  const d = v ? await getDeliverable(v.deliverable_id) : null;
  if (!v || !d) return { ok: false, status: 404, error: "Version not found." };
  const access = await projectAccess(d.project_id, caller);
  if (!access) return { ok: false, status: 404, error: "Version not found." };
  if (access.kind !== "guest" || !isProjectApprover(access, access.project)) {
    return { ok: false, status: 403, error: "Only the project's approver can do this." };
  }
  return { ok: true, v, d, access };
}
