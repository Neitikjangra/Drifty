import "server-only";
import { DbError } from "@/lib/db/repo";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { LedgerRow } from "./rules";

function check<T>(op: string, res: { data: T; error: { code?: string } | null }): T {
  if (res.error) throw new DbError(op, res.error.code);
  return res.data;
}

/**
 * Every approval in a project, newest first (FR-13). `approvals` is insert-only, so this is
 * exactly what was approved (copy snapshot + asset hash), even if things changed later.
 */
export async function ledgerRows(projectId: string): Promise<LedgerRow[]> {
  const db = supabaseAdmin();
  const ds = check("ledgerDeliverables", await db.from("deliverables").select("id, title").eq("project_id", projectId)) as {
    id: string;
    title: string;
  }[];
  if (!ds.length) return [];
  const vs = check("ledgerVersions", await db.from("versions").select("id, deliverable_id, number").in("deliverable_id", ds.map((d) => d.id))) as {
    id: string;
    deliverable_id: string;
    number: number;
  }[];
  if (!vs.length) return [];
  const as = check(
    "ledgerApprovals",
    await db
      .from("approvals")
      .select("id, version_id, approver_id, approved_at, copy_snapshot, asset_sha256")
      .in("version_id", vs.map((v) => v.id))
      .order("approved_at", { ascending: false }),
  ) as { id: string; version_id: string; approver_id: string; approved_at: string; copy_snapshot: string; asset_sha256: string }[];
  if (!as.length) return [];
  const ids = [...new Set(as.map((a) => a.approver_id))];
  const ps = check("ledgerProfiles", await db.from("profiles").select("user_id, display_name").in("user_id", ids)) as {
    user_id: string;
    display_name: string | null;
  }[];
  const name = new Map(ps.map((p) => [p.user_id, p.display_name ?? ""]));
  const vOf = new Map(vs.map((v) => [v.id, v]));
  const dOf = new Map(ds.map((d) => [d.id, d]));
  return as.map((a) => {
    const v = vOf.get(a.version_id)!;
    const d = dOf.get(v.deliverable_id)!;
    return {
      approvalId: a.id,
      deliverableId: d.id,
      deliverable: d.title,
      version: v.number,
      versionId: v.id,
      approverId: a.approver_id,
      approver: name.get(a.approver_id) || "Approver",
      approvedAt: a.approved_at,
      copy: a.copy_snapshot,
      assetSha256: a.asset_sha256,
    };
  });
}
