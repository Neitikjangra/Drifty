import { connection } from "next/server";
import { envPresence } from "@/lib/env";

/** GET /api/health: liveness plus which config keys are set (names only, never values). */
export async function GET() {
  await connection(); // always run at request time
  return Response.json(
    {
      ok: true,
      service: "drifty",
      time: new Date().toISOString(),
      configured: envPresence(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
