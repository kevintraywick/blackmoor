/**
 * One-off: introduce H3 adoption as v4. Bumps existing v4+ items up by 1,
 * inserts new v4 items, regenerates ROADMAP.md.
 *
 * Run once: node scripts/bump-for-v4-h3.mjs
 */

import pg from 'pg';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROADMAP_PATH = join(__dirname, '..', 'ROADMAP.md');

for (const envFile of ['.env.local', '.env']) {
  try {
    const envPath = resolve(__dirname, '..', envFile);
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* file doesn't exist, that's fine */ }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

// 1. Bump versions >= 4 up by one
await pool.query('UPDATE roadmap_items SET version = version + 1 WHERE version >= 4');
console.log('bumped versions >= 4');

// 2. Insert new v4 items (H3 adoption)
const v4Items = [
  'Add `h3-js` dependency and `lib/h3.ts` helpers (cell ↔ lat/lng, k-ring, parent/child, pentagon-cell lookup)',
  'Schema: nullable `h3_cell bigint` + `h3_res smallint` columns on spatial tables (world hexes, local maps, NPCs, AR encounters)',
  'World anchor: pick real lat/lng and H3 resolution for current Shadow world map',
  'Backfill: existing world-hex (col,row) coords → `h3_cell` at chosen resolution',
  'Dual-write: world-map writes populate `h3_cell` alongside legacy (col,row); reads remain on legacy path',
];

for (let i = 0; i < v4Items.length; i++) {
  await pool.query(
    `INSERT INTO roadmap_items (ladder, version, title, status, sort_order) VALUES ($1, $2, $3, $4, $5)`,
    ['common', 4, v4Items[i], 'planned', (i + 1) * 10],
  );
}
console.log(`inserted ${v4Items.length} v4 items`);

// 3. Regenerate ROADMAP.md with section headers shifted + items reissued from DB
const { rows: items } = await pool.query(
  'SELECT version, title, status, sort_order FROM roadmap_items ORDER BY version, sort_order',
);

const raw = await readFile(ROADMAP_PATH, 'utf8');
let lines = raw.split('\n');

// Shift section headers v{N} -> v{N+1} for N >= 4
lines = lines.map(line => {
  const m = line.match(/^(###\s+)v(\d+)\b(.*)$/i);
  if (!m) return line;
  const n = parseInt(m[2], 10);
  if (n < 4) return line;
  return `${m[1]}v${n + 1}${m[3]}`;
});

// Insert new v4 section right before the (now-shifted) v5 header
const v5Idx = lines.findIndex(l => /^###\s+v5\b/i.test(l));
if (v5Idx >= 0) {
  lines.splice(v5Idx, 0, '### v4 — H3 adoption', '');
}

// Filter out all item lines with version tags — we'll re-emit from DB
const itemRe = /^-\s+\[[ x]\]\s+.+?<!--\s*common-v\d+\s*-->/;
const filtered = lines.filter(line => !itemRe.test(line));

const byVersion = new Map();
for (const item of items) {
  const arr = byVersion.get(item.version) ?? [];
  arr.push(item);
  byVersion.set(item.version, arr);
}

const sectionRe = /^###\s+v(\d+)\b/i;
const result = [];
for (const line of filtered) {
  result.push(line);
  const sectionMatch = line.match(sectionRe);
  if (!sectionMatch) continue;
  const version = parseInt(sectionMatch[1], 10);
  const sectionItems = byVersion.get(version);
  if (!sectionItems) continue;
  const nextLineIdx = filtered.indexOf(line) + 1;
  if (nextLineIdx < filtered.length && filtered[nextLineIdx] === '') {
    result.push('');
  }
  for (const item of sectionItems) {
    const check = item.status === 'built' ? '[x]' : '[ ]';
    const tag = `<!-- common-v${version} -->`;
    const extra = item.status === 'in_progress' ? ' <!-- in-progress -->' : '';
    result.push(`- ${check} ${item.title} ${tag}${extra}`);
  }
  byVersion.delete(version);
}

const next = result
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/\n+$/, '\n');

await writeFile(ROADMAP_PATH, next, 'utf8');
console.log('wrote ROADMAP.md');

await pool.end();
