import { z } from "zod";
import { spikeEnabled } from "@/lib/env";
import { handleRouteError, jsonError } from "@/lib/http";
import { issueAccessToken } from "@/lib/nexconn/api";
import { ensureSpikeChannel, SPIKE_CHANNEL_ID, SPIKE_USERS } from "@/lib/nexconn/spike";


const body = z.object({ user: z.enum(["alice", "bob"]) });

/** POST /api/spike/session: token for one of the two spike test users. Test-only. */
export async function POST(req: Request) {
  if (!spikeEnabled()) return jsonError(404, "Not found");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Pick a test user.");

  try {
    const u = SPIKE_USERS[parsed.data.user];
    await ensureSpikeChannel();
    const token = await issueAccessToken(u.userId, u.name);
    return Response.json(
      {
        token,
        userId: u.userId,
        channelId: SPIKE_CHANNEL_ID,
        users: Object.values(SPIKE_USERS),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return handleRouteError("spike/session", err);
  }
}
