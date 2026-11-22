import "server-only";
import { routeProjectAccess, type ProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { getDeliverable, getVersion } from "@/lib/db/deliverables";
import { supabaseAdmin } from "@/lib/db/supabase-server";

export interface ChangeItemRow {
  id: string;
  version_id: string;
  change_list_id: string | null;
  position: number | null;
  text: string;
  type: string;
  status: string;
  author_ids: string[];
  source_msg_ids: string[];
  conflict_id: string | null;
}

/** Loads a change item and checks the caller is an owner/AM of its project. */
export async function manageableItem(
  itemId: string,
): Promise<{ ok: true; item: ChangeItemRow; access: ProjectAccess; cardMessageId: string | null } | { ok: false; status: 401 | 403 | 404 }> {
  if (!/^[0-9a-f-]{36}$/.test(itemId)) return { ok: false, status: 404 };
  const { data } = await supabaseAdmin()
    .from("change_items")
    .select("id, version_id, change_list_id, position, text, type, status, author_ids, source_msg_ids, conflict_id")
    .eq("id", itemId)
    .maybeSingle();
  const item = data as ChangeItemRow | null;
  if (!item) return { ok: false, status: 404 };
  const v = await getVersion(item.version_id);
  const d = v ? await getDeliverable(v.deliverable_id) : null;
  if (!d) return { ok: false, status: 404 };
  const res = await routeProjectAccess(d.project_id);
  if (!res.ok) return { ok: false, status: res.status };
  if (res.access.kind !== "member" || !canManageProjects(res.access.role)) return { ok: false, status: 403 };
  let cardMessageId: string | null = null;
  if (item.change_list_id) {
    const cl = await supabaseAdmin().from("change_lists").select("card_message_id").eq("id", item.change_list_id).maybeSingle();
    cardMessageId = (cl.data as { card_message_id: string | null } | null)?.card_message_id ?? null;
  }
  return { ok: true, item, access: res.access, cardMessageId };
}
