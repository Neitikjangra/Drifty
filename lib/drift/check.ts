import "server-only";
import { AiError, generateJson } from "@/lib/ai/gemini";
import { sanitizeDrift } from "@/lib/ai/guards";
import { AI3_SYSTEM, ai3Prompt } from "@/lib/ai/prompts";
import { driftJsonSchema, driftSchema, type DriftOutput } from "@/lib/ai/schemas";
import type { Deliverable, Version } from "@/lib/db/deliverables";
import { DbError } from "@/lib/db/repo";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Project } from "@/lib/db/types";
import { setItemOnCard } from "@/lib/feedback/summarise";
import { sendGroupMessage, setGroupMessageMetadata } from "@/lib/nexconn/api";
import { BOT_USER_ID, MSG } from "@/lib/nexconn/ids";
import { ensureBot } from "@/lib/nexconn/rooms";
import { downloadAsset } from "@/lib/storage";
import type { DriftCard, DriftCardStatus } from "./cards";
import { driftCounts, itemsToCheck, type ItemForCheck } from "./rules";

/**
 * FR-11 version drift check. When vN+1 is uploaded and confirmed changes exist, the version is
 * held (deliverable status `draft`, no card in the client room) while AI-3 compares it with
 * the last version the client saw. The result is a `drifty:drift` card in the internal room;
 * the AM then sends it to the client or back to the creative (app/api/drift/[id]).
 */

function check<T>(op: string, res: { data: T; error: { code?: string } | null }): T {
  if (res.error) throw new DbError(op, res.error.code);
  return res.data;
}

export interface VersionAlertDetail {
  fromVersionId: string;
  fromVersion: number;
  toVersionId: string;
  toVersion: number;
  itemIds: string[];
  state: "checking" | "ready";
  aiChecked?: boolean;
  results?: { itemId: string; verdict: string; note: string }[];
  decision?: "sent" | "back" | "superseded";
}

export interface VersionAlert {
  id: string;
  deliverable_id: string;
  version_id: string;
  detail: VersionAlertDetail;
  card_message_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

/** The newest version the client actually saw (has a card in the client room). */
export async function lastSentVersion(deliverableId: string): Promise<Version | null> {
  const rows = check(
    "lastSentVersion",
    await supabaseAdmin()
      .from("versions")
      .select("id, created_at, deliverable_id, number, asset_path, asset_sha256, asset_mime, copy_text, card_message_id, created_by")
      .eq("deliverable_id", deliverableId)
      .not("card_message_id", "is", null)
      .order("number", { ascending: false })
      .limit(1),
  ) as Version[];
  return rows[0] ?? null;
}

/** Change items the next version must be checked against (see itemsToCheck). */
export async function driftItems(deliverableId: string, lastSent: Version): Promise<ItemForCheck[]> {
  const db = supabaseAdmin();
  const versions = check("driftVersions", await db.from("versions").select("id, number").eq("deliverable_id", deliverableId)) as {
    id: string;
    number: number;
  }[];
  const upTo = versions.filter((v) => v.number <= lastSent.number).map((v) => v.id);
  if (!upTo.length) return [];
  const items = check(
    "driftItems",
    await db.from("change_items").select("id, version_id, text, type, status, created_at").in("version_id", upTo),
  ) as ItemForCheck[];
  return itemsToCheck(items, lastSent.id);
}

export async function openVersionAlerts(deliverableId: string): Promise<VersionAlert[]> {
  return check(
    "openVersionAlerts",
    await supabaseAdmin()
      .from("drift_alerts")
      .select("id, deliverable_id, version_id, detail, card_message_id, resolved_at, resolved_by")
      .eq("deliverable_id", deliverableId)
      .eq("kind", "version")
      .is("resolved_at", null),
  ) as VersionAlert[];
}

export async function getVersionAlert(id: string): Promise<VersionAlert | null> {
  const row = check(
    "getVersionAlert",
    await supabaseAdmin()
      .from("drift_alerts")
      .select("id, deliverable_id, version_id, detail, card_message_id, resolved_at, resolved_by, kind")
      .eq("id", id)
      .maybeSingle(),
  ) as (VersionAlert & { kind: string }) | null;
  return row && row.kind === "version" ? row : null;
}

export async function setDriftCardStatus(project: Project, alert: VersionAlert, status: DriftCardStatus, by?: string) {
  if (!alert.card_message_id || !project.internal_channel_id) return;
  await setGroupMessageMetadata({
    messageId: alert.card_message_id,
    operatorUserId: BOT_USER_ID,
    channelId: project.internal_channel_id,
    metadata: { status, ...(by ? { by: by.slice(0, 64), at: new Date().toISOString() } : {}) },
  });
}

/** A newer upload replaces a held version: its open check is closed as superseded. */
export async function supersedeOpenAlerts(project: Project, deliverableId: string) {
  const open = await openVersionAlerts(deliverableId);
  for (const a of open) {
    await supabaseAdmin()
      .from("drift_alerts")
      .update({ resolved_at: new Date().toISOString(), detail: { ...a.detail, decision: "superseded" } })
      .eq("id", a.id)
      .is("resolved_at", null);
    await setDriftCardStatus(project, a, "superseded").catch(() => {});
  }
}

export async function createVersionAlert(d: Deliverable, from: Version, to: Version, items: ItemForCheck[]): Promise<VersionAlert> {
  const detail: VersionAlertDetail = {
    fromVersionId: from.id,
    fromVersion: from.number,
    toVersionId: to.id,
    toVersion: to.number,
    itemIds: items.map((i) => i.id),
    state: "checking",
  };
  return check(
    "createVersionAlert",
    await supabaseAdmin()
      .from("drift_alerts")
      .insert({ deliverable_id: d.id, version_id: to.id, kind: "version", detail })
      .select("id, deliverable_id, version_id, detail, card_message_id, resolved_at, resolved_by")
      .single(),
  ) as VersionAlert;
}

// Gemini reads PNG/JPEG/WebP images and PDFs inline; keep each under ~7 MB (request limit).
const VISION_MIME = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_INLINE = 7 * 1024 * 1024;

async function loadPair(from: Version, to: Version) {
  if (!VISION_MIME.has(from.asset_mime) || !VISION_MIME.has(to.asset_mime)) return null;
  try {
    const [a, b] = await Promise.all([downloadAsset(from.asset_path), downloadAsset(to.asset_path)]);
    if (a.byteLength > MAX_INLINE || b.byteLength > MAX_INLINE) return null;
    return [
      { mimeType: from.asset_mime, data: a, label: `Old version (v${from.number}):` },
      { mimeType: to.asset_mime, data: b, label: `New version (v${to.number}):` },
    ];
  } catch {
    return null;
  }
}

/**
 * Runs AI-3, records each item's verdict (change_items + the change list card) and posts the
 * drift card. If the AI is unavailable every item is "needs human check": the version is
 * still held and a person decides, so nothing reaches the client unchecked.
 */
export async function runDriftCheck(project: Project, d: Deliverable, alert: VersionAlert, from: Version, to: Version, items: ItemForCheck[]) {
  const db = supabaseAdmin();
  const media = await loadPair(from, to);
  let out: DriftOutput | null = null;
  try {
    out = await generateJson({
      task: "ai3-drift",
      system: AI3_SYSTEM,
      prompt: ai3Prompt({
        title: d.title,
        fromVersion: from.number,
        toVersion: to.number,
        oldCopy: from.copy_text,
        newCopy: to.copy_text,
        items: items.map((i) => ({ id: i.id, text: i.text, type: i.type })),
        images: media ? "both" : "none",
      }),
      jsonSchema: driftJsonSchema,
      zod: driftSchema,
      thinking: "medium",
      media: media ?? undefined,
      timeouts: { first: 20_000, last: 40_000 },
    });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
  }
  const results = sanitizeDrift(out, items, Boolean(media));
  const byId = new Map(items.map((i) => [i.id, i]));

  // The current alert may have been superseded by a newer upload while the AI ran.
  const fresh = await getVersionAlert(alert.id);
  if (!fresh || fresh.resolved_at) return;

  // Item statuses (PRD: done/missing/reversed/needs_check) + the change list card chips.
  const { data: rows } = await db.from("change_items").select("id, position, change_list_id, text").in("id", items.map((i) => i.id));
  const meta = (rows ?? []) as { id: string; position: number | null; change_list_id: string | null; text: string }[];
  const listIds = [...new Set(meta.map((m) => m.change_list_id).filter(Boolean))] as string[];
  const { data: lists } = listIds.length ? await db.from("change_lists").select("id, card_message_id").in("id", listIds) : { data: [] };
  const cardOf = new Map(((lists ?? []) as { id: string; card_message_id: string | null }[]).map((l) => [l.id, l.card_message_id]));
  await Promise.all(
    results.map(async (r) => {
      await db.from("change_items").update({ status: r.verdict }).eq("id", r.itemId);
      const m = meta.find((x) => x.id === r.itemId);
      if (m && m.position !== null && m.change_list_id) {
        await setItemOnCard(project, cardOf.get(m.change_list_id) ?? null, m.position, { s: r.verdict, t: m.text }).catch(() => {});
      }
    }),
  );

  const card: DriftCard = {
    alertId: alert.id,
    deliverableId: d.id,
    title: d.title,
    fromVersion: from.number,
    toVersion: to.number,
    toVersionId: to.id,
    aiChecked: Boolean(out),
    results: results.map((r) => ({
      itemId: r.itemId,
      text: (byId.get(r.itemId)?.text ?? "").slice(0, 300),
      type: byId.get(r.itemId)?.type ?? "other",
      verdict: r.verdict,
      note: r.note,
    })),
  };
  const c = driftCounts(results);
  await ensureBot();
  const cardId = await sendGroupMessage({
    fromUserId: BOT_USER_ID,
    channelId: project.internal_channel_id!,
    messageType: MSG.drift,
    content: card as unknown as Record<string, unknown>,
    pushContent: `Drift check ${d.title} v${to.number}: ${c.done} done, ${c.missing + c.reversed} missing/reversed, ${c.needs_check} to check`,
    metadata: { status: "open" },
  });
  await db
    .from("drift_alerts")
    .update({ card_message_id: cardId, detail: { ...alert.detail, state: "ready", aiChecked: Boolean(out), results } })
    .eq("id", alert.id);
}

/** Latest version check per deliverable (open or decided) for the project page. */
export async function latestVersionAlerts(deliverableIds: string[]): Promise<Map<string, VersionAlert>> {
  if (!deliverableIds.length) return new Map();
  const rows = check(
    "latestVersionAlerts",
    await supabaseAdmin()
      .from("drift_alerts")
      .select("id, deliverable_id, version_id, detail, card_message_id, resolved_at, resolved_by, created_at")
      .in("deliverable_id", deliverableIds)
      .eq("kind", "version")
      .order("created_at", { ascending: false }),
  ) as VersionAlert[];
  const out = new Map<string, VersionAlert>();
  for (const r of rows) if (!out.has(r.deliverable_id)) out.set(r.deliverable_id, r);
  return out;
}
