import "server-only";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { inviteLink } from "@/lib/invites";

export interface DemoProgress {
  summarised: boolean;
  conflictSettled: boolean;
  /** The AI found at least one conflict (otherwise step 2 is skipped). */
  hadConflict: boolean;
  confirmed: boolean;
  uploadedV2: boolean;
  sentToClient: boolean;
  approved: boolean;
  /** Relative /join/… paths for the demo client people (the page adds its own origin). */
  links: { name: string; role: string; path: string }[];
}

/** Where the agency is in the demo, from the real project data (no separate state to drift). */
export async function demoProgress(projectId: string): Promise<DemoProgress> {
  const db = supabaseAdmin();
  const { data: ds } = await db.from("deliverables").select("id, status, current_version").eq("project_id", projectId);
  const deliverables = (ds ?? []) as { id: string; status: string; current_version: number }[];
  const dIds = deliverables.map((d) => d.id);
  const { data: vs } = dIds.length ? await db.from("versions").select("id").in("deliverable_id", dIds) : { data: [] };
  const vIds = ((vs ?? []) as { id: string }[]).map((v) => v.id);
  const [lists, items, alerts, invites] = await Promise.all([
    vIds.length ? db.from("change_lists").select("id", { count: "exact", head: true }).in("version_id", vIds) : Promise.resolve({ count: 0 }),
    vIds.length ? db.from("change_items").select("status").in("version_id", vIds) : Promise.resolve({ data: [] }),
    dIds.length ? db.from("drift_alerts").select("kind, resolved_at, detail").in("deliverable_id", dIds) : Promise.resolve({ data: [] }),
    db.from("invites").select("id, display_name, role, revoked_at").eq("project_id", projectId).is("revoked_at", null).order("created_at"),
  ]);
  const itemRows = ((items as { data: unknown[] | null }).data ?? []) as { status: string }[];
  const alertRows = ((alerts as { data: unknown[] | null }).data ?? []) as { kind: string; resolved_at: string | null; detail: { decision?: string } }[];
  const feedback = alertRows.filter((a) => a.kind === "feedback");
  const rows = (invites.data ?? []) as { id: string; display_name: string | null; role: string }[];
  const resolved = await Promise.all(rows.map(async (i) => ({ i, link: await inviteLink(i.id) })));
  const links = resolved
    .filter((r) => r.link)
    .map(({ i, link }) => ({ name: i.display_name ?? "Client", role: i.role, path: new URL(link!).pathname }));
  return {
    summarised: ((lists as { count: number | null }).count ?? 0) > 0,
    // No conflict found means nothing to settle: the step counts as done once summarised.
    conflictSettled: ((lists as { count: number | null }).count ?? 0) > 0 && feedback.every((a) => a.resolved_at),
    hadConflict: feedback.length > 0,
    confirmed: itemRows.some((i) => i.status !== "suggested" && i.status !== "rejected"),
    uploadedV2: deliverables.some((d) => d.current_version >= 2),
    sentToClient: alertRows.some((a) => a.kind === "version" && a.detail?.decision === "sent"),
    approved: deliverables.some((d) => d.status === "approved"),
    links,
  };
}
