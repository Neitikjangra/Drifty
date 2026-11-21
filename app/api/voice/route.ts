import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { routeProjectAccess } from "@/lib/access";
import { allowedRooms } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { appUrl } from "@/lib/env";
import { handleRouteError, jsonError, ok } from "@/lib/http";
import { storeMessage } from "@/lib/messages/store";
import { transcribeVoice, VOICE_BUCKET } from "@/lib/messages/voice";
import { sendGroupMessage } from "@/lib/nexconn/api";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SECONDS = 60; // Nexconn HD voice limit
const TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-m4a": "m4a",
};

/**
 * POST /api/voice (multipart: projectId, channelId, duration, file): a voice note recorded in
 * Drifty (FR-7). Stored privately, posted to the room as a Nexconn HD voice message
 * (RC:HQVCMsg) from the sender, and transcribed right after the response.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const projectId = String(form?.get("projectId") ?? "");
    const channelId = String(form?.get("channelId") ?? "");
    const duration = Math.round(Number(form?.get("duration") ?? 0));
    if (!(file instanceof File) || !/^[0-9a-f-]{36}$/.test(projectId)) return jsonError(400, "Record a voice note first.");
    const mime = file.type.split(";")[0];
    const ext = TYPES[mime];
    if (!ext) return jsonError(400, "This browser's recording format isn't supported.");
    if (file.size === 0 || file.size > MAX_BYTES) return jsonError(400, "Voice notes can be at most 10 MB.");
    if (!(duration >= 1 && duration <= MAX_SECONDS)) return jsonError(400, "Voice notes can be 1 to 60 seconds long.");

    const res = await routeProjectAccess(projectId);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Project not found.");
    const { access } = res;
    const rooms = allowedRooms(access.kind === "guest" ? { kind: "guest", role: access.role } : { kind: "member", role: access.role });
    const isClient = channelId === access.project.client_channel_id && rooms.client;
    const isInternal = channelId === access.project.internal_channel_id && rooms.internal;
    if (!isClient && !isInternal) return jsonError(403, "You can't post in this room.");
    if (!access.profile) return jsonError(403, "Finish setting up your account first.");

    const id = randomUUID();
    const path = `${projectId}/${id}.${ext}`;
    const up = await supabaseAdmin().storage.from(VOICE_BUCKET).upload(path, file, { contentType: mime, upsert: false });
    if (up.error) return jsonError(500, "Couldn't save the voice note. Please try again.");

    const sentAt = new Date().toISOString();
    const messageId = await sendGroupMessage({
      fromUserId: access.profile.nexconn_user_id,
      channelId,
      messageType: "RC:HQVCMsg",
      content: { remoteUrl: `${appUrl()}/api/voice/${id}`, duration, name: `voice-${id}.${ext}`, extra: "" },
      pushContent: `${access.profile.display_name}: [Voice]`,
      echoToSender: true,
    });
    await storeMessage(
      access.project,
      {
        nexconnMsgId: messageId,
        channelId,
        authorId: access.profile.nexconn_user_id,
        kind: "voice",
        text: null,
        replyToText: null,
        voiceRemoteUrl: null,
        voiceDuration: duration,
        sentAt,
      },
      { voicePath: path },
    );
    after(() => transcribeVoice({ nexconnMsgId: messageId, storagePath: path }).catch(() => console.warn("[voice] transcription failed")));
    return ok({ messageId }, 201);
  } catch (err) {
    return handleRouteError("voice", err);
  }
}
