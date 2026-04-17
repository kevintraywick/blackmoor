/**
 * One-off: slot in five brainstorm items missed during Phase 2 integration.
 * Appends to existing versions; no renumbering, no section changes.
 *
 * Run once: node scripts/add-missed-brainstorm-items.mjs
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

const adds = [
  { v: 4, title: 'Mappy sanity-checks local-map scale against real-world dimensions at the H3 anchor cell' },
  { v: 9, title: 'World-scale fog: unrevealed continents are "beyond known charts" until discovered' },
  { v: 10, title: 'Resolution tiers by DM class — newbie claims at res-7, Cartographer at res-5, World AI at res-4+' },
  { v: 12, title: 'Research pass: D&D royalty terminology (Houses / Holds / Reaches / Marches / Dominions) — pick 3-5 defaults' },
  { v: 12, title: 'Agent cost budget + kill switch — per-campaign monthly cap on Haiku/Sonnet calls, DM-visible pause control' },
];

const byV = new Map();
for (const a of adds) {
  (byV.get(a.v) ?? byV.set(a.v, []).get(a.v)).push(a);
}
for (const [v, list] of [...byV.entries()].sort((a, b) => a[0] - b[0])) {
  const { rows } = await pool.query(
    'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM roadmap_items WHERE version = $1',
    [v],
  );
  let order = rows[0].max_order + 10;
  for (const a of list) {
    await pool.query(
      'INSERT INTO roadmap_items (ladder, version, title, status, sort_order) VALUES ($1, $2, $3, $4, $5)',
      ['common', v, a.title, 'planned', order],
    );
    order += 10;
  }
  console.log(`inserted ${list.length} item(s) at v${v}`);
}

await pool.end();
