import { z } from "zod";
import { routeProjectAccess } from "@/lib/access";
import { canManageProjects } from "@/lib/auth/permissions";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { sendGroupMessage } from "@/lib/nexconn/api";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { loadMonthlyReport } from "@/lib/report/load";
import { parseMonth, reportSummaryText } from "@/lib/report/rules";

const body = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

/**
 * POST /api/projects/:id/report/share: the AM posts the month's report summary in the client
 * room, as their own message (the AI never messages clients). Owners/AMs only.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/report/share">) {
  const { id } = await ctx.params;
  const input = await readBody(req, body);
  if (!input) return jsonError(400, "Choose a month.");
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Not found.");
  try {
    const res = await routeProjectAccess(id);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Not found.");
    const access = res.access;
    if (access.kind !== "member" || !canManageProjects(access.role)) return jsonError(403, "Only owners and account managers can share reports.");
    const limited = await rateLimit(req, "report-share", LIMITS.write, access.userId);
    if (limited) return limited;
    const me = access.profile?.nexconn_user_id;
    if (!me || !access.project.client_channel_id) return jsonError(409, "The client room isn't ready.");
    const report = await loadMonthlyReport(id, parseMonth(input.month));
    if (!report.approvals && !report.versionsShipped && !report.changesCaptured) {
      return jsonError(409, "Nothing happened in this project that month, so there's no report to share.");
    }
    await sendGroupMessage({
      fromUserId: me,
      channelId: access.project.client_channel_id,
      messageType: "RC:TxtMsg",
      content: { content: reportSummaryText(access.project.client_name, report) },
    });
    return ok({ shared: true });
  } catch (err) {
    return handleRouteError("report/share", err);
  }
}
