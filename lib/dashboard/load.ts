import "server-only";
import type { Deliverable, Version } from "@/lib/db/deliverables";
import { DbError } from "@/lib/db/repo";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { buildDashboard, type Dashboard } from "./rules";

/** Loads the numbers for the project dashboard (FR-14) from data the project page already has. */
export async function loadDashboard(
  deliverables: (Deliverable & { versions: Version[] })[],
  roundsIncluded: number,
): Promise<Dashboard> {
  const db = supabaseAdmin();
  const versionIds = deliverables.flatMap((d) => d.versions.map((v) => v.id));
  const dOfVersion = new Map(deliverables.flatMap((d) => d.versions.map((v) => [v.id, d.id] as const)));
  const [items, conflicts] = versionIds.length
    ? await Promise.all([
        db.from("change_items").select("version_id, status").in("version_id", versionIds),
        db.from("drift_alerts").select("deliverable_id").eq("kind", "feedback").is("resolved_at", null).in("deliverable_id", deliverables.map((d) => d.id)),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (items.error) throw new DbError("dashboardItems", items.error.code);
  if (conflicts.error) throw new DbError("dashboardConflicts", conflicts.error.code);
  const openConflicts = new Map<string, number>();
  for (const c of (conflicts.data ?? []) as { deliverable_id: string }[]) {
    openConflicts.set(c.deliverable_id, (openConflicts.get(c.deliverable_id) ?? 0) + 1);
  }
  return buildDashboard(
    deliverables.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      currentVersion: d.current_version,
      sentVersions: d.versions.filter((v) => v.card_message_id).length,
      openConflicts: openConflicts.get(d.id) ?? 0,
    })),
    ((items.data ?? []) as { version_id: string; status: string }[]).map((i) => ({ deliverableId: dOfVersion.get(i.version_id) ?? "", status: i.status })),
    roundsIncluded,
  );
}
