/**
 * Pielieto supabase/schema.sql.
 * Vajag: SUPABASE_DB_PASSWORD (Project Settings → Database)
 *
 *   SUPABASE_DB_PASSWORD='...' node scripts/apply-schema.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const REF = "yepcjzlffitwgwdujtxz";
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("Trūkst SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "schema.sql");
const sql = readFileSync(sqlPath, "utf8");

const hosts = [
  `postgresql://postgres.${REF}:${encodeURIComponent(password)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${REF}:${encodeURIComponent(password)}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres:${encodeURIComponent(password)}@db.${REF}.supabase.co:5432/postgres`,
];

let lastErr;
for (const connectionString of hosts) {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(sql);
    await client.end();
    console.log("OK — shēma pielietota");
    process.exit(0);
  } catch (err) {
    lastErr = err;
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

console.error("Neizdevās pieslēgties DB:", lastErr?.message || lastErr);
process.exit(1);
