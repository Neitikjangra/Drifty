// Applies supabase/migrations/*.sql in name order, once each, inside a transaction.
// Usage: pnpm db:migrate   (reads SUPABASE_DB_URL from .env.local; never prints it)
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });
const url = process.env.SUPABASE_DB_URL?.trim().replace(/^"(.*)"$/, "$1");
if (!url) {
  console.error("SUPABASE_DB_URL is not set in .env.local");
  process.exit(1);
}

const dir = path.resolve("supabase/migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(`create table if not exists public._migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  await client.query("alter table public._migrations enable row level security");
  const { rows } = await client.query("select name from public._migrations");
  const done = new Set(rows.map((r) => r.name));

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    process.stdout.write(`applying ${file} ... `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public._migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log("ok");
      applied++;
    } catch (err) {
      await client.query("rollback");
      console.log("FAILED");
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }
  console.log(applied ? `${applied} migration(s) applied.` : "Database is up to date.");
} catch (err) {
  // Connection errors can echo the host; never the password.
  console.error("Could not connect:", err instanceof Error ? err.message.replace(/:\/\/[^@]*@/, "://***@") : "unknown");
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
