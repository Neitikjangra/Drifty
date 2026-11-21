import "server-only";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import type { Project } from "@/lib/db/types";
import { DbError } from "@/lib/db/repo";
import type { ParsedMessage } from "./parse";

const PROJ_COLS =
  "id, created_at, workspace_id, client_name, approver_id, rounds_included, client_channel_id, internal_channel_id, archived";

/** The project whose client or internal room this channel is, or null. */
export async function projectForChannel(channelId: string): Promise<Project | null> {
  if (!/^[A-Za-z0-9]{1,64}$/.test(channelId)) return null;
  const { data, error } = await supabaseAdmin()
    .from("projects")
    .select(PROJ_COLS)
    .or(`client_channel_id.eq.${channelId},internal_channel_id.eq.${channelId}`)
    .maybeSingle();
  if (error) throw new DbError("projectForChannel", error.code);
  return data as Project | null;
}

/** Inserts once per Nexconn message id (webhook retries and our own sends dedupe here). */
export async function storeMessage(
  project: Project,
  m: ParsedMessage,
  extra: { voicePath?: string; transcript?: string } = {},
): Promise<{ id: string; inserted: boolean }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("messages")
    .upsert(
      {
        project_id: project.id,
        channel_id: m.channelId,
        nexconn_msg_id: m.nexconnMsgId,
        author_id: m.authorId,
        kind: m.kind,
        text: m.text,
        reply_to_msg_id: m.replyToText ? `quote:${m.replyToText.slice(0, 200)}` : null,
        voice_url: extra.voicePath ?? m.voiceRemoteUrl,
        transcript: extra.transcript ?? null,
        sent_at: m.sentAt,
      },
      { onConflict: "nexconn_msg_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new DbError("storeMessage", error.code);
  if (data && data.length) return { id: (data[0] as { id: string }).id, inserted: true };
  const existing = await db.from("messages").select("id").eq("nexconn_msg_id", m.nexconnMsgId).maybeSingle();
  return { id: (existing.data as { id: string } | null)?.id ?? "", inserted: false };
}

export async function setTranscript(nexconnMsgId: string, transcript: string) {
  const { error } = await supabaseAdmin().from("messages").update({ transcript }).eq("nexconn_msg_id", nexconnMsgId);
  if (error) throw new DbError("setTranscript", error.code);
}

export interface StoredMessage {
  nexconn_msg_id: string;
  author_id: string;
  kind: string;
  text: string | null;
  transcript: string | null;
  reply_to_msg_id: string | null;
  voice_url: string | null;
  sent_at: string;
}

/** Client-room feedback since a time (newest 200), oldest first. */
export async function feedbackSince(channelId: string, sinceIso: string): Promise<StoredMessage[]> {
  const { data, error } = await supabaseAdmin()
    .from("messages")
    .select("nexconn_msg_id, author_id, kind, text, transcript, reply_to_msg_id, voice_url, sent_at")
    .eq("channel_id", channelId)
    .gte("sent_at", sinceIso)
    .in("kind", ["text", "voice"])
    .order("sent_at", { ascending: false })
    .limit(200);
  if (error) throw new DbError("feedbackSince", error.code);
  return ((data ?? []) as StoredMessage[]).reverse();
}
