import "server-only";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { buildMonthlyReport, type MonthlyReport } from "./rules";

/** Loads one project's data and builds the report for `month` (YYYY-MM, India time). */
export async function loadMonthlyReport(projectId: string, month: string): Promise<MonthlyReport> {
  const db = supabaseAdmin();
  const { data: ds } = await db.from("deliverables").select("id, title, created_at").eq("project_id", projectId);
  const deliverables = ((ds ?? []) as { id: string; title: string; created_at: string }[]).map((d) => ({ id: d.id, title: d.title, createdAt: d.created_at }));
  const dIds = deliverables.map((d) => d.id);
  if (!dIds.length) return buildMonthlyReport(month, { deliverables: [], sentVersions: [], approvals: [], changeItems: [], alerts: [] });

  const { data: vs } = await db
    .from("versions")
    .select("id, deliverable_id, number, created_at, card_message_id")
    .in("deliverable_id", dIds);
  const versions = (vs ?? []) as { id: string; deliverable_id: string; number: number; created_at: string; card_message_id: string | null }[];
  const vIds = versions.map((v) => v.id);
  const [aps, items, alerts] = await Promise.all([
    vIds.length ? db.from("approvals").select("version_id, approved_at").in("version_id", vIds) : Promise.resolve({ data: [] }),
    vIds.length ? db.from("change_items").select("status, created_at").in("version_id", vIds) : Promise.resolve({ data: [] }),
    db.from("drift_alerts").select("kind, created_at, detail").in("deliverable_id", dIds).in("kind", ["feedback", "version"]),
  ]);
  return buildMonthlyReport(month, {
    deliverables,
    sentVersions: versions.filter((v) => v.card_message_id).map((v) => ({ id: v.id, deliverableId: v.deliverable_id, number: v.number, createdAt: v.created_at })),
    approvals: ((aps.data ?? []) as { version_id: string; approved_at: string }[]).map((a) => ({ versionId: a.version_id, approvedAt: a.approved_at })),
    changeItems: ((items.data ?? []) as { status: string; created_at: string }[]).map((c) => ({ status: c.status, createdAt: c.created_at })),
    alerts: ((alerts.data ?? []) as { kind: string; created_at: string; detail: { results?: { verdict: string }[] } }[]).map((a) => ({
      kind: a.kind,
      createdAt: a.created_at,
      // A conflict always counts; a version check counts when it flagged something not done.
      flagged: a.kind === "feedback" || (a.detail?.results ?? []).some((r) => r.verdict !== "done"),
    })),
  });
}
