/**
 * One-off: apply the v3 item #20 H3 columns immediately.
 *
 * Mirrors the ALTER TABLE block in lib/schema.ts — running this
 * against the shared DB means the columns show up without waiting
 * for the next dev-server restart (ensureSchema is memoized).
 *
 * Idempotent. Safe to re-run.
 *
 * Run once: node scripts/add-h3-columns.mjs
 */

import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const envFile of ['.env.local', '.env']) {
  try {
    const envPath = resolve(__dirname, '..', envFile);
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* ignore */ }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

const TABLES = ['world_map', 'world_hexes', 'map_builds', 'world_entities', 'npcs'];

for (const t of TABLES) {
  await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS h3_cell BIGINT`);
  await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS h3_res  SMALLINT`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS ${t}_h3_cell_idx ON ${t} (h3_cell) WHERE h3_cell IS NOT NULL`,
  );
  console.log(`  ✓ ${t}: h3_cell + h3_res + index`);
}

// Verification — read back the column types for each table
console.log('\nVerifying columns:');
const { rows } = await pool.query(`
  SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name IN ('h3_cell', 'h3_res')
  ORDER BY table_name, column_name
`);
for (const r of rows) {
  console.log(`  ${r.table_name}.${r.column_name} ${r.data_type} null=${r.is_nullable}`);
}

await pool.end();
