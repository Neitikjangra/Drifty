import "server-only";
import { z } from "zod";
import { AiError, generateJson } from "@/lib/ai/gemini";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Project } from "@/lib/db/types";
import { sendGroupMessage } from "@/lib/nexconn/api";
import { BOT_USER_ID, MSG } from "@/lib/nexconn/ids";
import { ensureBot } from "@/lib/nexconn/rooms";
import type { ScopeCard } from "./cards";
import { scopeNoteTemplate, scopeState } from "./rules";

const noteSchema = z.object({ note: z.string().min(20).max(600) });
const noteJsonSchema = {
  type: "object",
  properties: { note: { type: "string", description: "the message to the client, 2-3 sentences" } },
  required: ["note"],
} as const;

const AI5_SYSTEM =
  "You write a short, warm, professional note from a creative agency to its client about revision rounds. " +
  "State the facts given (rounds used and included) without blame, offer to keep helping, and suggest agreeing on extra rounds. " +
  "2-3 sentences, plain English, no prices, no promises, no emojis.";

/**
 * FR-15 scope drift (AI-5). After a version reaches the client, if this deliverable's revision
 * rounds are at or past what the project includes, warn the AM in the internal room with a
 * draft client note. The AM edits, sends or discards it; the AI never messages the client.
 * One warning per deliverable per round count.
 */
export async function checkScope(project: Project, deliverableId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const [{ data: d }, { count }] = await Promise.all([
    db.from("deliverables").select("id, title").eq("id", deliverableId).maybeSingle(),
    db.from("versions").select("id", { count: "exact", head: true }).eq("deliverable_id", deliverableId).not("card_message_id", "is", null),
  ]);
  const deliverable = d as { id: string; title: string } | null;
  if (!deliverable || !project.internal_channel_id) return false;
  const used = Math.max(0, (count ?? 0) - 1);
  const included = project.rounds_included;
  const state = scopeState(used, included);
  if (!state) return false;

  const { data: prior } = await db.from("drift_alerts").select("detail").eq("deliverable_id", deliverableId).eq("kind", "scope");
  if (((prior ?? []) as { detail: { roundsUsed?: number } }[]).some((a) => a.detail?.roundsUsed === used)) return false;

  let draft = scopeNoteTemplate({ title: deliverable.title, roundsUsed: used, included, state });
  try {
    const out = await generateJson({
      task: "ai5-scope",
      system: AI5_SYSTEM,
      prompt: `Deliverable: ${deliverable.title}. Revision rounds used: ${used}. Rounds included in the agreement: ${included}. ${
        state === "at_limit" ? "This version uses the last included round." : "The project is now beyond the included rounds."
      }`,
      jsonSchema: noteJsonSchema,
      zod: noteSchema,
      thinking: "low",
      timeouts: { first: 10_000, last: 20_000 },
    });
    draft = out.note.trim();
  } catch (err) {
    if (!(err instanceof AiError)) throw err; // AI unavailable: the template is a fine draft
  }

  const { data: alertRow, error } = await db
    .from("drift_alerts")
    .insert({ deliverable_id: deliverableId, kind: "scope", detail: { roundsUsed: used, roundsIncluded: included, state } })
    .select("id")
    .single();
  if (error || !alertRow) return false;
  const alertId = (alertRow as { id: string }).id;
  const card: ScopeCard = { alertId, deliverableId, title: deliverable.title, roundsUsed: used, roundsIncluded: included, state, draft: draft.slice(0, 600) };
  await ensureBot();
  const msgId = await sendGroupMessage({
    fromUserId: BOT_USER_ID,
    channelId: project.internal_channel_id,
    messageType: MSG.scope,
    content: card as unknown as Record<string, unknown>,
    pushContent: `Scope: ${deliverable.title} is ${state === "over" ? "past" : "at"} its ${included} included rounds`,
    metadata: { status: "open" },
  });
  await db.from("drift_alerts").update({ card_message_id: msgId }).eq("id", alertId);
  return true;
}
