import "server-only";
import { workspaceMemberNexconnIds } from "@/lib/db/repo";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { runJob } from "@/lib/jobs";
import { sendGroupMessage } from "@/lib/nexconn/api";
import { BOT_USER_ID } from "@/lib/nexconn/ids";
import { ensureBot } from "@/lib/nexconn/rooms";
import { digestText, istDate, nudgeText, nudgeWhen, type DigestInput } from "./rules";

/**
 * The daily run (Vercel Cron, ~09:00 IST): FR-17 nudges in client rooms and the FR-18 digest
 * in internal rooms. Each is recorded in `jobs` so a re-run on the same day never sends twice.
 * Logs counts only, never content.
 */

type Row = Record<string, unknown>;

async function doneBefore(kind: string, key: string, value: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("jobs").select("id").eq("kind", kind).eq("status", "done").eq(`payload->>${key}`, value).limit(1);
  return Boolean(data?.length);
}

export async function runDaily(now = new Date(), onlyProjectId?: string): Promise<{ projects: number; nudges: number; digests: number }> {
  const db = supabaseAdmin();
  const day = istDate(now);
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
  let q = db
    .from("projects")
    .select("id, workspace_id, client_name, approver_id, client_channel_id, internal_channel_id")
    .eq("archived", false)
    .not("internal_channel_id", "is", null);
  if (onlyProjectId) q = q.eq("id", onlyProjectId); // one project (tests / a manual re-run)
  const { data: ps } = await q.limit(500);
  const projects = (ps ?? []) as { id: string; workspace_id: string; client_name: string; approver_id: string | null; client_channel_id: string | null; internal_channel_id: string }[];
  let nudges = 0;
  let digests = 0;
  if (projects.length) await ensureBot();

  for (const p of projects) {
    const { data: ds } = await db.from("deliverables").select("id, title, status, current_version, due_date").eq("project_id", p.id);
    const deliverables = (ds ?? []) as { id: string; title: string; status: string; current_version: number; due_date: string | null }[];
    if (!deliverables.length) continue;
    const dIds = deliverables.map((d) => d.id);
    const [{ data: vs }, { data: conflicts }, { data: approver }] = await Promise.all([
      db.from("versions").select("id, deliverable_id, number, created_at, card_message_id").in("deliverable_id", dIds),
      db.from("drift_alerts").select("deliverable_id").eq("kind", "feedback").is("resolved_at", null).in("deliverable_id", dIds),
      p.approver_id ? db.from("profiles").select("display_name").eq("user_id", p.approver_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const versions = (vs ?? []) as { id: string; deliverable_id: string; number: number; created_at: string; card_message_id: string | null }[];
    const approverName = (approver as { display_name?: string } | null)?.display_name ?? null;

    // FR-17: nudge the approver about unapproved cards due today/tomorrow (once per version).
    for (const d of deliverables) {
      const when = nudgeWhen(d.due_date, d.status, now);
      const v = versions.find((x) => x.deliverable_id === d.id && x.number === d.current_version && x.card_message_id);
      if (!when || !v || !p.client_channel_id || !p.approver_id) continue;
      if (await doneBefore("nudge", "versionId", v.id)) continue;
      const channel = p.client_channel_id;
      const text = nudgeText({ title: d.title, version: v.number, dueDate: d.due_date!, when, approver: approverName });
      if (await runJob("nudge", { versionId: v.id }, () => sendGroupMessage({ fromUserId: BOT_USER_ID, channelId: channel, messageType: "RC:TxtMsg", content: { content: text } }))) nudges++;
    }

    // FR-18: digest in the internal room (once per project per day; skipped when there's nothing to say).
    const key = `${p.id}:${day}`;
    if (await doneBefore("digest", "key", key)) continue;
    const vIds = versions.map((v) => v.id);
    const [{ data: aps }, { count: lists }, members, { data: msgs }] = await Promise.all([
      vIds.length ? db.from("approvals").select("version_id, approver_id").in("version_id", vIds).gte("approved_at", since) : Promise.resolve({ data: [] }),
      vIds.length ? db.from("change_lists").select("id", { count: "exact", head: true }).in("version_id", vIds).gte("created_at", since) : Promise.resolve({ count: 0 }),
      workspaceMemberNexconnIds(p.workspace_id),
      p.client_channel_id
        ? db.from("messages").select("author_id").eq("channel_id", p.client_channel_id).in("kind", ["text", "voice"]).gte("sent_at", since)
        : Promise.resolve({ data: [] }),
    ]);
    const approvals = (aps ?? []) as Row[];
    const approverIds = [...new Set(approvals.map((a) => a.approver_id as string))];
    const { data: names } = approverIds.length ? await db.from("profiles").select("user_id, display_name").in("user_id", approverIds) : { data: [] };
    const nameOf = new Map(((names ?? []) as { user_id: string; display_name: string }[]).map((n) => [n.user_id, n.display_name]));
    const team = new Set([...members, BOT_USER_ID]);
    const input: DigestInput = {
      clientName: p.client_name,
      approvals: approvals.map((a) => {
        const v = versions.find((x) => x.id === a.version_id)!;
        return { title: deliverables.find((d) => d.id === v.deliverable_id)?.title ?? "", version: v.number, by: nameOf.get(a.approver_id as string) ?? "the approver" };
      }),
      newVersions: versions
        .filter((v) => v.created_at >= since && v.number > 1)
        .map((v) => ({ title: deliverables.find((d) => d.id === v.deliverable_id)?.title ?? "", version: v.number, held: !v.card_message_id })),
      changeLists: (lists as number | null) ?? 0,
      clientMessages: ((msgs ?? []) as { author_id: string }[]).filter((m) => !team.has(m.author_id)).length,
      deliverables: deliverables.map((d) => ({
        title: d.title,
        version: d.current_version,
        status: d.status,
        dueDate: d.due_date,
        openConflicts: ((conflicts ?? []) as { deliverable_id: string }[]).filter((c) => c.deliverable_id === d.id).length,
      })),
    };
    const text = digestText(input);
    if (!text) continue;
    if (await runJob("digest", { key }, () => sendGroupMessage({ fromUserId: BOT_USER_ID, channelId: p.internal_channel_id, messageType: "RC:TxtMsg", content: { content: text } }))) digests++;
  }
  console.info(`[daily] projects=${projects.length} nudges=${nudges} digests=${digests}`);
  return { projects: projects.length, nudges, digests };
}
