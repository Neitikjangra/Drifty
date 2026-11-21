import "server-only";
import { transcribeAudio } from "@/lib/ai/gemini";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { setTranscript } from "./store";

export const VOICE_BUCKET = "voice";

/**
 * Transcribes a voice note and saves the transcript (FR-7). Uses our stored copy when we have
 * one (voice notes recorded in Drifty), otherwise downloads Nexconn's remote URL.
 * Logs only ids/latency, never audio or text.
 */
export async function transcribeVoice(opts: { nexconnMsgId: string; storagePath?: string | null; remoteUrl?: string | null }) {
  let bytes: Uint8Array | null = null;
  let mime = "audio/webm";
  if (opts.storagePath && !/^https?:/.test(opts.storagePath)) {
    const { data } = await supabaseAdmin().storage.from(VOICE_BUCKET).download(opts.storagePath);
    if (data) {
      bytes = new Uint8Array(await data.arrayBuffer());
      mime = data.type || mimeFromPath(opts.storagePath);
    }
  } else if (opts.remoteUrl && /^https:\/\//.test(opts.remoteUrl)) {
    const res = await fetch(opts.remoteUrl, { signal: AbortSignal.timeout(15_000) });
    if (res.ok) {
      bytes = new Uint8Array(await res.arrayBuffer());
      mime = res.headers.get("content-type")?.split(";")[0] || mimeFromPath(opts.remoteUrl);
    }
  }
  if (!bytes || bytes.byteLength === 0) throw new Error("voice audio not available");
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("voice note too large");
  const transcript = await transcribeAudio(bytes, mime);
  await setTranscript(opts.nexconnMsgId, transcript || "(no speech)");
  return transcript;
}

function mimeFromPath(p: string) {
  if (/\.(m4a|mp4)$/i.test(p)) return "audio/mp4";
  if (/\.aac$/i.test(p)) return "audio/aac";
  if (/\.ogg$/i.test(p)) return "audio/ogg";
  if (/\.mp3$/i.test(p)) return "audio/mpeg";
  if (/\.wav$/i.test(p)) return "audio/wav";
  return "audio/webm";
}
