/**
 * One-off: swap v3 (Map Builder) and v4 (Spatial substrate / H3) in the ladder.
 *
 * H3 becomes the foundation; Map Builder features that touch world
 * coords sit cleanly on top.
 *
 * Run once: node scripts/swap-v3-v4.mjs
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
  } catch { /* ignore */ }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

// Swap v3 <-> v4 via a sentinel
await pool.query('UPDATE roadmap_items SET version = 9999 WHERE version = 3');
await pool.query('UPDATE roadmap_items SET version = 3 WHERE version = 4');
await pool.query('UPDATE roadmap_items SET version = 4 WHERE version = 9999');
console.log('swapped v3 <-> v4 in DB');

// Rewrite ROADMAP.md section headers + regenerate items
const titleByVersion = new Map([
  [3, 'Spatial substrate (H3)'],
  [4, 'Map Builder'],
  [5, 'Housekeeping + ops'],
  [6, 'DM identity'],
  [7, 'Campaign scoping (multi-tenancy)'],
  [8, 'Cutover — `campaign_id` NOT NULL'],
  [9, 'Read-only Common World'],
  [10, 'Claim + publish (contributor flow)'],
  [11, 'Content lifecycle + canon'],
  [12, 'Living world (entities + agents)'],
  [13, 'Economy — monetary'],
  [14, 'Magic system + MP economy'],
  [15, 'News, weather, celestial'],
  [16, 'Steampunk + airships'],
  [17, 'Creative destruction'],
  [18, 'Moderated comments'],
  [19, 'Crossover sessions'],
  [20, 'Internal battle-test (synthetic campaigns)'],
  [21, 'Closed beta (real DMs)'],
  [22, 'Public launch'],
  [23, 'Contributor portfolios'],
  [24, 'ERC-20 token bridge (planning only)'],
]);

const raw = await readFile(ROADMAP_PATH, 'utf8');
let lines = raw.split('\n');

lines = lines.map(line => {
  const m = line.match(/^###\s+v(\d+)\b/i);
  if (!m) return line;
  const n = parseInt(m[1], 10);
  const title = titleByVersion.get(n);
  if (title) return `### v${n} — ${title}`;
  return line;
});

// Strip item lines; regenerate from DB
const itemRe = /^-\s+\[[ x]\]\s+.+?<!--\s*common-v\d+\s*-->/;
const filtered = lines.filter(line => !itemRe.test(line));

const { rows: items } = await pool.query(
  'SELECT version, title, status, sort_order FROM roadmap_items ORDER BY version, sort_order',
);

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

const next = result.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
await writeFile(ROADMAP_PATH, next, 'utf8');
console.log('wrote ROADMAP.md');

await pool.end();
