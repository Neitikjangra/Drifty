import { z } from "zod";
import { getCaller } from "@/lib/access";
import { handleRouteError, jsonError, ok, readBody } from "@/lib/http";
import { subscriptionSchema } from "@/lib/push/rules";
import { deleteSubscription, pushConfigured, saveSubscription } from "@/lib/push/send";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

/** The signed-in person (agency member or client guest) with a profile, or an error response. */
async function signedIn() {
  const caller = await getCaller();
  if (caller.kind === "anonymous") return { error: jsonError(401, "Sign in first.") } as const;
  if (!caller.profile) return { error: jsonError(409, "Finish setting up your profile first.") } as const;
  return { userId: caller.userId } as const;
}

/** POST /api/push/subscribe: turn notifications on for this browser. */
export async function POST(req: Request) {
  if (!pushConfigured()) return jsonError(503, "Notifications aren't set up yet.");
  const input = await readBody(req, subscriptionSchema);
  if (!input) return jsonError(400, "Invalid subscription.");
  try {
    const who = await signedIn();
    if ("error" in who) return who.error;
    const limited = await rateLimit(req, "push-subscribe", LIMITS.write, who.userId);
    if (limited) return limited;
    await saveSubscription(who.userId, input);
    return ok({ on: true }, 201);
  } catch (err) {
    return handleRouteError("push/subscribe", err);
  }
}

/** DELETE /api/push/subscribe: turn them off for this browser. */
export async function DELETE(req: Request) {
  const input = await readBody(req, z.object({ endpoint: z.string().url().max(1000) }));
  if (!input) return jsonError(400, "Invalid request.");
  try {
    const who = await signedIn();
    if ("error" in who) return who.error;
    await deleteSubscription(who.userId, input.endpoint);
    return ok({ on: false });
  } catch (err) {
    return handleRouteError("push/subscribe", err);
  }
}
