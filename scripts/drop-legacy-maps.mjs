/**
 * One-off: drop the legacy `maps` table.
 *
 * The `maps` subsystem was deprecated 2026-04-19. Map Builder (`map_builds`)
 * is now the only image-map path. Production table was empty at removal time;
 * this is a zero-data-loss drop.
 *
 * Idempotent (DROP TABLE IF EXISTS). Safe to re-run.
 *
 * Run once: node scripts/drop-legacy-maps.mjs
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

// Safety check — bail if anything landed in the table since deprecation.
const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM maps').catch(() => ({ rows: [{ n: 0 }] }));
if (rows[0].n > 0) {
  console.error(`ABORT — maps table has ${rows[0].n} row(s). Investigate before dropping.`);
  await pool.end();
  process.exit(1);
}

await pool.query('DROP TABLE IF EXISTS maps');
console.log('dropped table: maps');

await pool.end();
