import { NextResponse } from "next/server";
import { getCaller, projectAccess } from "@/lib/access";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { handleRouteError, jsonError } from "@/lib/http";
import { VOICE_BUCKET } from "@/lib/messages/voice";

/**
 * GET /api/voice/:id: plays a voice note. ChatUI's player loads this URL (same origin, so the
 * viewer's cookies are sent); we check they belong to the project and redirect to a
 * short-lived signed URL from the private bucket.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/voice/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Not found.");
  try {
    const caller = await getCaller();
    if (caller.kind === "anonymous") return jsonError(401, "Please sign in.");
    const { data } = await supabaseAdmin()
      .from("messages")
      .select("project_id, channel_id, voice_url")
      .like("voice_url", `%/${id}.%`)
      .maybeSingle();
    const row = data as { project_id: string; channel_id: string; voice_url: string } | null;
    if (!row) return jsonError(404, "Not found.");
    const access = await projectAccess(row.project_id, caller);
    // Clients may only hear voice notes from the client room.
    if (!access || (access.kind === "guest" && row.channel_id !== access.project.client_channel_id)) {
      return jsonError(404, "Not found.");
    }
    const signed = await supabaseAdmin().storage.from(VOICE_BUCKET).createSignedUrl(row.voice_url, 300);
    if (signed.error || !signed.data) return jsonError(404, "Not found.");
    return NextResponse.redirect(signed.data.signedUrl, { status: 302, headers: { "Cache-Control": "private, max-age=240" } });
  } catch (err) {
    return handleRouteError("voice/get", err);
  }
}
