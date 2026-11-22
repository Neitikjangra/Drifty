import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { getDeliverable, getVersion, setVersionCard, transitionDeliverable } from "@/lib/db/deliverables";
import { supabaseAdmin } from "@/lib/db/supabase-server";
import { postDeliverableCard, setCardStatus } from "@/lib/deliverables/cards-server";
import { getVersionAlert, lastSentVersion, setDriftCardStatus } from "@/lib/drift/check";
import { backToCreativeText } from "@/lib/drift/rules";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { sendGroupMessage } from "@/lib/nexconn/api";
import { BOT_USER_ID } from "@/lib/nexconn/ids";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { checkScope } from "@/lib/round6/scope";
import { runJob } from "@/lib/jobs";
import { after } from "next/server";

const body = z.object({ action: z.enum(["send", "back"]) });

/**
 * POST /api/drift/:id: the AM's decision on a held version (FR-11).
 * - "send": posts the held version's card in the client room (supersedes the old card).
 * - "back": tells the creative what's still missing; the version stays out of the client room.
 * Owners and AMs only, verified here. Each check is decided once (atomic claim).
 */
export async function POST(req: Request, ctx: RouteContext<"/api/drift/[id]">) {
  const { id } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Choose send or back.");
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Not found.");
  try {
    const alert = await getVersionAlert(id);
    const d = alert ? await getDeliverable(alert.deliverable_id) : null;
    if (!alert || !d) return jsonError(404, "Not found.");
    const res = await routeProjectAccess(d.project_id);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Not found.");
    const limited = await rateLimit(req, "drift", LIMITS.write, res.access.userId);
    if (limited) return limited;
    const access = res.access;
    if (access.kind !== "member" || !canManageProjects(access.role)) {
      return jsonError(403, "Only owners and account managers can decide this.");
    }
    if (alert.resolved_at) return jsonError(409, alert.detail.decision === "superseded" ? "A newer version replaced this one." : "This was already decided.");
    const to = await getVersion(alert.detail.toVersionId);
    if (!to || to.number !== d.current_version || d.status !== "draft") return jsonError(409, "A newer version replaced this one.");

    const db = supabaseAdmin();
    const now = new Date().toISOString();
    const claim = await db
      .from("drift_alerts")
      .update({ resolved_by: access.userId, resolved_at: now, detail: { ...alert.detail, decision: input.action === "send" ? "sent" : "back" } })
      .eq("id", alert.id)
      .is("resolved_at", null)
      .select("id");
    if (!claim.data?.length) return jsonError(409, "This was already decided.");
    const unclaim = () => db.from("drift_alerts").update({ resolved_by: null, resolved_at: null, detail: alert.detail }).eq("id", alert.id);
    const project = access.project;
    const name = access.profile?.display_name ?? "The AM";

    if (input.action === "send") {
      const previous = await lastSentVersion(d.id);
      if (!(await transitionDeliverable(d.id, to.number, ["draft"], "in_review"))) {
        await unclaim();
        return jsonError(409, "A newer version replaced this one.");
      }
      let messageId: string;
      try {
        messageId = await postDeliverableCard(project, d, to);
      } catch (err) {
        await transitionDeliverable(d.id, to.number, ["in_review"], "draft");
        await unclaim();
        throw err;
      }
      await Promise.all([
        setVersionCard(to.id, messageId),
        previous && previous.id !== to.id ? setCardStatus(project, previous, "superseded").catch(() => {}) : Promise.resolve(),
        setDriftCardStatus(project, alert, "sent", name).catch(() => {}),
      ]);
      // FR-15: a new round reached the client; warn the AM if it's at/over the included rounds.
      after(() => runJob("scope-check", { deliverableId: d.id }, () => checkScope(project, d.id)));
      return ok({ decision: "sent", version: to.number });
    }

    // Back to creative
    const results = alert.detail.results ?? [];
    const { data: items } = results.length
      ? await db.from("change_items").select("id, text").in("id", results.map((r) => r.itemId))
      : { data: [] };
    const textOf = new Map(((items ?? []) as { id: string; text: string }[]).map((i) => [i.id, i.text]));
    const text = backToCreativeText(
      d.title,
      to.number,
      results.map((r) => ({ text: textOf.get(r.itemId) ?? "", verdict: r.verdict, note: r.note })),
    );
    await Promise.all([
      sendGroupMessage({
        fromUserId: BOT_USER_ID,
        channelId: project.internal_channel_id!,
        messageType: "RC:TxtMsg",
        content: { content: text.slice(0, 4000) },
      }),
      setDriftCardStatus(project, alert, "back", name).catch(() => {}),
    ]);
    return ok({ decision: "back", version: to.number });
  } catch (err) {
    return handleRouteError("drift/decide", err);
  }
}
