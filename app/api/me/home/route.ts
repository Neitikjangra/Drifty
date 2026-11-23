import { getCaller } from "@/lib/access";
import { guestProjectIds } from "@/lib/db/repo";
import { ok } from "@/lib/http";

/**
 * GET /api/me/home: where "home" is for whoever is signed in on this browser, for the public
 * pages' logo and header. Agency: their projects. Client: their room. Nobody: null.
 */
export async function GET() {
  try {
    const caller = await getCaller();
    if (caller.kind === "member") return ok({ home: caller.membership ? "/app" : "/app/onboarding", kind: "member" });
    if (caller.kind === "guest") {
      const [first] = await guestProjectIds(caller.userId);
      return ok({ home: first ? `/room/${first}` : null, kind: "guest" });
    }
  } catch {
    // Signed-out view is the safe fallback.
  }
  return ok({ home: null, kind: "anonymous" });
}
