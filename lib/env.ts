import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Values are read lazily so a missing key only breaks
 * the route that needs it, with a message that names the key (never its value).
 */
const key = z.string().min(1);

const nexconnSchema = z.object({
  NEXT_PUBLIC_NEXCONN_APP_KEY: key,
  NEXCONN_APP_SECRET: key,
  NEXCONN_API_BASE: key.default("api.sg-light-api.com"),
});
const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
});
const supabaseAdminSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: key,
});

export class MissingEnvError extends Error {
  constructor(public readonly keys: string[]) {
    super(`Missing or invalid environment variables: ${keys.join(", ")}`);
    this.name = "MissingEnvError";
  }
}

function read<S extends z.ZodObject>(schema: S): z.infer<S> {
  const raw = Object.fromEntries(
    Object.keys(schema.shape).map((k) => [k, emptyToUndefined(process.env[k])]),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new MissingEnvError([...new Set(parsed.error.issues.map((i) => String(i.path[0])))]);
  }
  return parsed.data;
}

function emptyToUndefined(v: string | undefined) {
  return v === undefined || v.trim() === "" ? undefined : v.trim();
}

export const nexconnEnv = () => read(nexconnSchema);
export const supabaseEnv = () => read(supabaseSchema);
export const supabaseAdminEnv = () => read(supabaseAdminSchema);

/** The spike routes are test-only and must be switched on explicitly. */
export const spikeEnabled = () => process.env.SPIKE_ENABLED === "1";

/** Names of the keys the app needs, with presence only (for /api/health). */
export function envPresence(): Record<string, boolean> {
  const keys = [
    "NEXT_PUBLIC_NEXCONN_APP_KEY",
    "NEXCONN_APP_SECRET",
    "NEXCONN_API_BASE",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
  ];
  return Object.fromEntries(
    keys.map((k) => [k, emptyToUndefined(process.env[k]) !== undefined]),
  );
}
