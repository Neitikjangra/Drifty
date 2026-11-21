import "server-only";
import { AiError, generateJson } from "@/lib/ai/gemini";
import { capMessages, sanitizeConflicts, sanitizeItems, type FeedbackMessage } from "@/lib/ai/guards";
import { AI1_SYSTEM, AI2_SYSTEM, ai1Prompt, ai2Prompt } from "@/lib/ai/prompts";
import { changeListJsonSchema, changeListSchema, conflictsJsonSchema, conflictsSchema } from "@/lib/ai/schemas";
import { getVersionByNumber, type Deliverable } from "@/lib/db/deliverables";
import { DbError, listGuests } from "@/lib/db/repo";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Project } from "@/lib/db/types";
import { feedbackSince } from "@/lib/messages/store";
import { transcribeVoice } from "@/lib/messages/voice";
import { sendGroupMessage, setGroupMessageMetadata } from "@/lib/nexconn/api";
import { BOT_USER_ID, MSG } from "@/lib/nexconn/ids";
import { ensureBot } from "@/lib/nexconn/rooms";
import { itemKey, type ChangeListCard, type ConflictCard } from "./cards";

export class SummariseError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "SummariseError";
  }
}

function check<T>(op: string, res: { data: T; error: { code?: string } | null }): T {
  if (res.error) throw new DbError(op, res.error.code);
  return res.data;
}

/**
 * FR-8 + FR-12: AI-1 change list from client-room feedback since the current version, AI-2
 * conflicts between different people. Posts the change list card in the internal room and a
 * conflict card (approver decides) in the client room. Runs only when the AM presses
 * "Summarise feedback" (cost control).
 */
export async function summarise(project: Project, d: Deliverable, createdBy: string) {
  const v = await getVersionByNumber(d.id, d.current_version);
  if (!v) throw new SummariseError("This deliverable has no version yet.");
  if (!project.client_channel_id || !project.internal_channel_id) throw new SummariseError("This project's rooms aren't ready.");

  // Who's who: only client people's messages are feedback.
  const guests = await listGuests(project.id);
  const profiles = guests.length
    ? (check(
        "profiles",
        await supabaseAdmin().from("profiles").select("user_id, nexconn_user_id, display_name").in("user_id", guests.map((g) => g.user_id)),
      ) as { user_id: string; nexconn_user_id: string; display_name: string }[])
    : [];
  const byNexconn = new Map(
    profiles.map((p) => [p.nexconn_user_id, { name: p.display_name, role: guests.find((g) => g.user_id === p.user_id)?.role ?? "reviewer" }]),
  );

  const stored = (await feedbackSince(project.client_channel_id, v.created_at)).filter((m) => byNexconn.has(m.author_id));

  // Voice notes that weren't transcribed yet (e.g. a webhook arrived just now): try once now.
  for (const m of stored) {
    if (m.kind === "voice" && !m.transcript && m.voice_url) {
      const isOwn = !/^https?:/.test(m.voice_url);
      m.transcript = await transcribeVoice({
        nexconnMsgId: m.nexconn_msg_id,
        storagePath: isOwn ? m.voice_url : null,
        remoteUrl: isOwn ? null : m.voice_url,
      }).catch(() => null);
    }
  }

  const messages: FeedbackMessage[] = capMessages(
    stored
      .map((m) => {
        const who = byNexconn.get(m.author_id)!;
        const body = m.kind === "voice" ? (m.transcript && m.transcript !== "(no speech)" ? `[voice note] ${m.transcript}` : "") : (m.text ?? "");
        const reply = m.reply_to_msg_id?.startsWith("quote:") ? ` (replying to: "${m.reply_to_msg_id.slice(6, 120)}")` : "";
        return { id: m.nexconn_msg_id, authorId: m.author_id, authorName: who.name, role: who.role, text: body + reply, sentAt: m.sent_at };
      })
      .filter((m) => m.text.trim().length > 0),
  );
  if (messages.length === 0) {
    throw new SummariseError(`No client feedback yet since v${v.number} was posted. Ask the client to reply in the client room.`);
  }

  // AI-1 (thinking low)
  const ai1 = await generateJson({
    task: "ai1-changelist",
    system: AI1_SYSTEM,
    prompt: ai1Prompt({ title: d.title, version: v.number, copy: v.copy_text, messages }),
    jsonSchema: changeListJsonSchema,
    zod: changeListSchema,
    thinking: "low",
  });
  const items = sanitizeItems(ai1, messages);
  if (items.length === 0) throw new SummariseError("The AI didn't find any change requests in the client's messages.");

  // AI-2 (thinking low) only when 2+ different people asked for things.
  const names = new Map(messages.map((m) => [m.authorId, m.authorName]));
  const distinctAuthors = new Set(items.flatMap((i) => i.author_ids));
  let conflicts: { item_a: number; item_b: number; summary: string }[] = [];
  if (items.length >= 2 && distinctAuthors.size >= 2) {
    try {
      const ai2 = await generateJson({
        task: "ai2-conflicts",
        system: AI2_SYSTEM,
        prompt: ai2Prompt(items, names),
        jsonSchema: conflictsJsonSchema,
        zod: conflictsSchema,
        thinking: "low",
      });
      conflicts = sanitizeConflicts(ai2, items);
    } catch (err) {
      if (!(err instanceof AiError)) throw err; // a change list without conflict check is still useful
    }
  }

  // Store
  const db = supabaseAdmin();
  const list = check(
    "insertChangeList",
    await db.from("change_lists").insert({ version_id: v.id, created_by: createdBy, message_count: messages.length }).select("id").single(),
  ) as { id: string };
  const rows = check(
    "insertChangeItems",
    await db
      .from("change_items")
      .insert(
        items.map((it, position) => ({
          position,
          version_id: v.id,
          change_list_id: list.id,
          text: it.text.slice(0, 1000),
          type: it.type,
          author_ids: it.author_ids,
          source_msg_ids: it.source_msg_ids,
          status: "suggested",
          confidence: it.confidence,
          origin: "ai",
        })),
      )
      .select("id"),
  ) as { id: string }[];

  // Post the change list card (internal room)
  await ensureBot();
  const msgText = new Map(messages.map((m) => [m.id, m.text]));
  const card: ChangeListCard = {
    changeListId: list.id,
    deliverableId: d.id,
    versionId: v.id,
    version: v.number,
    title: d.title,
    items: items.map((it, i) => ({
      id: rows[i].id,
      text: it.text.slice(0, 300),
      type: it.type,
      author: it.author_ids.map((a) => names.get(a) ?? "Client").join(", "),
      sourceMsgId: it.source_msg_ids[0],
      source: (msgText.get(it.source_msg_ids[0]) ?? "").slice(0, 200),
      status: "suggested",
    })),
  };
  const cardId = await sendGroupMessage({
    fromUserId: BOT_USER_ID,
    channelId: project.internal_channel_id,
    messageType: MSG.changelist,
    content: card as unknown as Record<string, unknown>,
    pushContent: `Change list for ${d.title} v${v.number}: ${items.length} item(s)`,
    metadata: Object.fromEntries(items.map((_, i) => [itemKey(i), JSON.stringify({ s: "suggested" })])),
  });
  check("setChangeListCard", await db.from("change_lists").update({ card_message_id: cardId }).eq("id", list.id));

  // FR-12: conflict cards (client room), approver decides
  for (const c of conflicts) {
    const a = items[c.item_a];
    const b = items[c.item_b];
    const alert = check(
      "insertConflict",
      await db
        .from("drift_alerts")
        .insert({
          deliverable_id: d.id,
          version_id: v.id,
          kind: "feedback",
          detail: { summary: c.summary, itemA: rows[c.item_a].id, itemB: rows[c.item_b].id, changeListId: list.id, indexA: c.item_a, indexB: c.item_b },
        })
        .select("id")
        .single(),
    ) as { id: string };
    const conflictCard: ConflictCard = {
      conflictId: alert.id,
      deliverableId: d.id,
      title: d.title,
      version: v.number,
      summary: c.summary.slice(0, 300),
      optionA: { text: a.text.slice(0, 300), author: a.author_ids.map((x) => names.get(x) ?? "Client").join(", ") },
      optionB: { text: b.text.slice(0, 300), author: b.author_ids.map((x) => names.get(x) ?? "Client").join(", ") },
    };
    const conflictMsg = await sendGroupMessage({
      fromUserId: BOT_USER_ID,
      channelId: project.client_channel_id,
      messageType: MSG.conflict,
      content: conflictCard as unknown as Record<string, unknown>,
      pushContent: `Drifty AI: two requests on ${d.title} conflict. The approver can choose.`,
      metadata: { status: "open" },
    });
    check("setConflictCard", await db.from("drift_alerts").update({ card_message_id: conflictMsg }).eq("id", alert.id));
  }

  return { changeListId: list.id, items: items.length, conflicts: conflicts.length, messages: messages.length };
}

/** Updates one item's chip on the change list card (FR-9), in place for everyone. */
export async function setItemOnCard(project: Project, cardMessageId: string | null, index: number, meta: { s: string; t?: string }) {
  if (!cardMessageId || !project.internal_channel_id) return;
  await setGroupMessageMetadata({
    messageId: cardMessageId,
    operatorUserId: BOT_USER_ID,
    channelId: project.internal_channel_id,
    metadata: { [itemKey(index)]: JSON.stringify(meta).slice(0, 4000) },
  });
}
