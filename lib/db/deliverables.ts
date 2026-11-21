import "server-only";
import type { DeliverableStatus } from "@/lib/deliverables/rules";
import { DbError } from "./repo";
import { supabaseAdmin } from "./supabase-server";

export interface Deliverable {
  id: string;
  created_at: string;
  project_id: string;
  title: string;
  due_date: string | null;
  status: DeliverableStatus;
  current_version: number;
}

export interface Version {
  id: string;
  created_at: string;
  deliverable_id: string;
  number: number;
  asset_path: string;
  asset_sha256: string;
  asset_mime: string;
  copy_text: string;
  card_message_id: string | null;
  created_by: string;
}

export interface Approval {
  id: string;
  version_id: string;
  approver_id: string;
  approved_at: string;
  copy_snapshot: string;
  asset_sha256: string;
}

const D_COLS = "id, created_at, project_id, title, due_date, status, current_version";
const V_COLS = "id, created_at, deliverable_id, number, asset_path, asset_sha256, asset_mime, copy_text, card_message_id, created_by";

function check<T>(op: string, res: { data: T; error: { code?: string } | null }): T {
  if (res.error) throw new DbError(op, res.error.code);
  return res.data;
}

export async function listDeliverables(projectId: string): Promise<(Deliverable & { versions: Version[]; approvals: Approval[] })[]> {
  const db = supabaseAdmin();
  const ds = check(
    "listDeliverables",
    await db.from("deliverables").select(D_COLS).eq("project_id", projectId).order("created_at", { ascending: false }),
  ) as Deliverable[];
  if (!ds.length) return [];
  const vs = check(
    "listVersions",
    await db.from("versions").select(V_COLS).in("deliverable_id", ds.map((d) => d.id)).order("number", { ascending: false }),
  ) as Version[];
  const as = vs.length
    ? (check(
        "listApprovals",
        await db.from("approvals").select("id, version_id, approver_id, approved_at, copy_snapshot, asset_sha256").in("version_id", vs.map((v) => v.id)),
      ) as Approval[])
    : [];
  return ds.map((d) => {
    const versions = vs.filter((v) => v.deliverable_id === d.id);
    const ids = new Set(versions.map((v) => v.id));
    return { ...d, versions, approvals: as.filter((a) => ids.has(a.version_id)) };
  });
}

export async function getDeliverable(id: string): Promise<Deliverable | null> {
  return check("getDeliverable", await supabaseAdmin().from("deliverables").select(D_COLS).eq("id", id).maybeSingle()) as Deliverable | null;
}

export async function getVersion(id: string): Promise<Version | null> {
  return check("getVersion", await supabaseAdmin().from("versions").select(V_COLS).eq("id", id).maybeSingle()) as Version | null;
}

export async function getVersionByNumber(deliverableId: string, n: number): Promise<Version | null> {
  return check(
    "getVersionByNumber",
    await supabaseAdmin().from("versions").select(V_COLS).eq("deliverable_id", deliverableId).eq("number", n).maybeSingle(),
  ) as Version | null;
}

export async function insertDeliverable(row: { project_id: string; title: string; due_date: string | null }): Promise<Deliverable> {
  return check(
    "insertDeliverable",
    await supabaseAdmin().from("deliverables").insert({ ...row, status: "in_review", current_version: 1 }).select(D_COLS).single(),
  ) as Deliverable;
}

export async function deleteDeliverable(id: string) {
  check("deleteDeliverable", await supabaseAdmin().from("deliverables").delete().eq("id", id));
}

export async function insertVersion(row: Omit<Version, "id" | "created_at" | "card_message_id">): Promise<Version> {
  return check("insertVersion", await supabaseAdmin().from("versions").insert(row).select(V_COLS).single()) as Version;
}

export async function deleteVersion(id: string) {
  check("deleteVersion", await supabaseAdmin().from("versions").delete().eq("id", id));
}

export async function setVersionCard(versionId: string, messageId: string) {
  check("setVersionCard", await supabaseAdmin().from("versions").update({ card_message_id: messageId }).eq("id", versionId));
}

export async function updateDeliverable(id: string, patch: Partial<Pick<Deliverable, "status" | "current_version">>) {
  check("updateDeliverable", await supabaseAdmin().from("deliverables").update(patch).eq("id", id));
}

/** Only moves status if it is still `from` (guards against double clicks / races). Returns success. */
export async function transitionDeliverable(id: string, version: number, from: DeliverableStatus[], to: DeliverableStatus) {
  const rows = check(
    "transitionDeliverable",
    await supabaseAdmin()
      .from("deliverables")
      .update({ status: to })
      .eq("id", id)
      .eq("current_version", version)
      .in("status", from)
      .select("id"),
  ) as { id: string }[];
  return rows.length === 1;
}

/** Ledger row (insert-only table). */
export async function insertApproval(row: Omit<Approval, "id">): Promise<Approval> {
  return check(
    "insertApproval",
    await supabaseAdmin().from("approvals").insert(row).select("id, version_id, approver_id, approved_at, copy_snapshot, asset_sha256").single(),
  ) as Approval;
}
