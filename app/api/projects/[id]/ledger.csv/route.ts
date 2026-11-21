import { routeProjectAccess } from "@/lib/access";
import { handleRouteError, jsonError } from "@/lib/http";
import { ledgerRows } from "@/lib/ledger/rows";
import { csvFileName, filterLedger, istDay, parseFilter, toCsv } from "@/lib/ledger/rules";

/**
 * GET /api/projects/:id/ledger.csv: the approval ledger as CSV (FR-13), with the same filters
 * as the ledger page (?deliverable, approver, from, to, q). Agency members of the project only.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/projects/[id]/ledger.csv">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(404, "Not found.");
  try {
    const res = await routeProjectAccess(id);
    if (!res.ok) return res.status === 401 ? jsonError(401, "Please sign in first.") : jsonError(404, "Not found.");
    if (res.access.kind !== "member") return jsonError(404, "Not found.");
    const rows = filterLedger(await ledgerRows(id), parseFilter(new URL(req.url).searchParams));
    const name = csvFileName(res.access.project.client_name, istDay(new Date().toISOString()));
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleRouteError("ledger.csv", err);
  }
}
