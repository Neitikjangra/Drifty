import "server-only";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { timeSaved, type TimeSaved } from "./time-saved";

/** Counts what Drifty did for these deliverables: change lists, drifts/conflicts caught, approvals. */
export async function loadTimeSaved(deliverableIds: string[]): Promise<TimeSaved> {
  if (!deliverableIds.length) return timeSaved({ changeLists: 0, drifts: 0, approvals: 0 });
  const db = supabaseAdmin();
  const { data: vs } = await db.from("versions").select("id").in("deliverable_id", deliverableIds);
  const vIds = ((vs ?? []) as { id: string }[]).map((v) => v.id);
  const [lists, drifts, approvals] = await Promise.all([
    vIds.length ? db.from("change_lists").select("id", { count: "exact", head: true }).in("version_id", vIds) : Promise.resolve({ count: 0 }),
    // Conflicts found (feedback) and version checks that flagged something are "drifts caught".
    db.from("drift_alerts").select("kind, detail").in("deliverable_id", deliverableIds).in("kind", ["feedback", "version", "scope"]),
    vIds.length ? db.from("approvals").select("id", { count: "exact", head: true }).in("version_id", vIds) : Promise.resolve({ count: 0 }),
  ]);
  const caught = ((drifts as { data: { kind: string; detail: { results?: { verdict: string }[] } }[] | null }).data ?? []).filter(
    (a) => a.kind !== "version" || (a.detail?.results ?? []).some((r) => r.verdict !== "done"),
  ).length;
  return timeSaved({
    changeLists: (lists as { count: number | null }).count ?? 0,
    drifts: caught,
    approvals: (approvals as { count: number | null }).count ?? 0,
  });
}

/** Workspace total for the Projects page. */
export async function loadWorkspaceTimeSaved(workspaceId: string): Promise<TimeSaved> {
  const db = supabaseAdmin();
  const { data: ps } = await db.from("projects").select("id").eq("workspace_id", workspaceId);
  const pIds = ((ps ?? []) as { id: string }[]).map((p) => p.id);
  if (!pIds.length) return timeSaved({ changeLists: 0, drifts: 0, approvals: 0 });
  const { data: ds } = await db.from("deliverables").select("id").in("project_id", pIds);
  return loadTimeSaved(((ds ?? []) as { id: string }[]).map((d) => d.id));
}
