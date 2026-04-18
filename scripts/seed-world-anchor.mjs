/**
 * One-off: seed the Common World anchor into `world_map`.
 *
 * Anchor = Blaen Hafren (source of the Severn on Plynlimon, Cambrian
 * Mountains, Wales). Chosen 2026-04-18.
 *
 *   lat: 52.4833°N
 *   lng: -3.7333°W
 *   res: 6 (6-mile-hex scale)
 *   cell: 86195e0f7ffffff
 *   bigint: 603928618510319615
 *
 * Idempotent — only writes if h3_cell is NULL. Safe to re-run.
 *
 * Run once: node scripts/seed-world-anchor.mjs
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

// Derived from SHADOW_WORLD_ANCHOR in lib/world-anchor.ts
const ANCHOR_CELL_BIGINT = 603928618510319615n;
const ANCHOR_RES = 6;

const res = await pool.query(
  `UPDATE world_map
   SET h3_cell = $1, h3_res = $2
   WHERE id = 'default' AND h3_cell IS NULL
   RETURNING id, h3_cell, h3_res`,
  [ANCHOR_CELL_BIGINT.toString(), ANCHOR_RES],
);

if (res.rowCount === 0) {
  const { rows } = await pool.query(
    `SELECT h3_cell::text AS h3_cell, h3_res FROM world_map WHERE id = 'default'`,
  );
  console.log('anchor already seeded:', rows[0]);
} else {
  console.log('seeded anchor:', res.rows[0]);
}

await pool.end();
