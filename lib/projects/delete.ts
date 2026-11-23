import "server-only";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Project } from "@/lib/db/types";
import { dismissGroupChannel } from "@/lib/nexconn/api";
import { BUCKET } from "@/lib/storage";

export const HAS_APPROVALS = "This project has approvals in its ledger, which is permanent, so it can't be deleted. Archive it instead.";

/** Number of approvals recorded on any version of the project's deliverables. */
export async function approvalCount(projectId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("approvals")
    .select("id, versions!inner(deliverables!inner(project_id))", { count: "exact", head: true })
    .eq("versions.deliverables.project_id", projectId);
  if (error) throw new Error(`approvalCount ${error.code ?? ""}`);
  return count ?? 0;
}

/**
 * Deletes a project for good: both Nexconn rooms (dismissed for everyone), its uploaded files,
 * then the project row (deliverables, messages, invites... cascade). Refuses when the project
 * has approvals, since the approval ledger is insert-only and never deleted.
 */
export async function deleteProjectEverywhere(project: Project): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((await approvalCount(project.id)) > 0) return { ok: false, error: HAS_APPROVALS };
  const db = supabaseAdmin();

  for (const ch of [project.client_channel_id, project.internal_channel_id]) {
    if (ch) await dismissGroupChannel(ch).catch(() => console.warn("[projects] room dismiss failed"));
  }

  // Files live under "<projectId>/..." in the deliverables bucket.
  const { data: files } = await db.storage.from(BUCKET).list(project.id, { limit: 1000 });
  const paths = (files ?? []).map((f) => `${project.id}/${f.name}`);
  if (paths.length) await db.storage.from(BUCKET).remove(paths).catch(() => console.warn("[projects] file cleanup failed"));

  const { error } = await db.from("projects").delete().eq("id", project.id);
  if (error) throw new Error(`deleteProject ${error.code ?? ""}`);
  return { ok: true };
}
