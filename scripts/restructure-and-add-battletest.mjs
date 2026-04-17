/**
 * One-off: restructure the ladder + add battle-test versions.
 *
 * 1. Move three misfiled items out of v3:
 *    - "DM game clock advance UI ..." → v12
 *    - "Environment pill on local maps ..." → v13
 *    - "Language overlay map" → v9
 * 2. Shift versions >= 17 up by 2 to make room.
 * 3. Insert new v17 (Internal battle-test) + v18 (Closed beta).
 * 4. Rewrite ROADMAP.md with renamed section headers + regenerated items.
 *
 * Run once: node scripts/restructure-and-add-battletest.mjs
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

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

// 1. Move three items out of v3
const moves = [
  { toVersion: 12, pattern: 'DM game clock advance UI%' },
  { toVersion: 13, pattern: 'Environment pill on local maps%' },
  { toVersion: 9, pattern: 'Language overlay map' },
];
for (const m of moves) {
  const { rows } = await pool.query(
    'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM roadmap_items WHERE version = $1',
    [m.toVersion],
  );
  const nextOrder = rows[0].max_order + 10;
  const result = await pool.query(
    'UPDATE roadmap_items SET version = $1, sort_order = $2 WHERE version = 3 AND title LIKE $3 RETURNING title',
    [m.toVersion, nextOrder, m.pattern],
  );
  console.log(`moved ${result.rowCount} item(s) matching "${m.pattern}" to v${m.toVersion}`);
}

// 2. Shift versions >= 17 up by 2 to make room for battle-test versions
await pool.query('UPDATE roadmap_items SET version = version + 2 WHERE version >= 17');
console.log('shifted versions >= 17 up by 2');

// 3. Insert v17 (Internal battle-test) + v18 (Closed beta) items
const v17Items = [
  'Synthetic DM + player personas (3–5 DMs, 4-player parties each, varied tiers)',
  'Scripted end-to-end run: onboarding → first claim → publish → 5+ sessions → content-lifecycle triggers',
  'Cross-campaign collision + crossover session scenarios exercised',
  'World-AI loops under synthetic load (entity movement, weather, rumors)',
  'Economy + common price-sheet flow exercised across 3+ campaigns',
  'Performance baseline + bug triage pass from battle-test findings',
];
for (let i = 0; i < v17Items.length; i++) {
  await pool.query(
    `INSERT INTO roadmap_items (ladder, version, title, status, sort_order) VALUES ($1, $2, $3, $4, $5)`,
    ['common', 17, v17Items[i], 'planned', (i + 1) * 10],
  );
}
console.log(`inserted ${v17Items.length} v17 items`);

const v18Items = [
  'Recruit 5–10 real DMs from existing network',
  'DM self-serve onboarding docs (can a new DM reach first claim without handholding?)',
  'Beta covenant page — what\'s stable, what isn\'t, what may change',
  'In-app feedback capture + weekly sync cadence',
  'Usage telemetry — per-feature touch rates, drop-off points',
  'Closed-beta exit criteria (crash rate, NPS, feature completeness) gating public launch',
];
for (let i = 0; i < v18Items.length; i++) {
  await pool.query(
    `INSERT INTO roadmap_items (ladder, version, title, status, sort_order) VALUES ($1, $2, $3, $4, $5)`,
    ['common', 18, v18Items[i], 'planned', (i + 1) * 10],
  );
}
console.log(`inserted ${v18Items.length} v18 items`);

// 4. Rewrite ROADMAP.md
const titleByVersion = new Map([
  [3, 'Map Builder'],
  [4, 'Spatial substrate (H3)'],
  [5, 'Housekeeping + ops'],
  [6, 'DM identity'],
  [7, 'Campaign scoping (multi-tenancy)'],
  [8, 'Cutover — `campaign_id` NOT NULL'],
  [9, 'Read-only Common World'],
  [10, 'Claim + publish (contributor flow)'],
  [11, 'Content lifecycle + canon'],
  [12, 'Living world + economy'],
  [13, 'News, weather, celestial'],
  [14, 'Creative destruction'],
  [15, 'Moderated comments'],
  [16, 'Crossover sessions'],
  [17, 'Internal battle-test (synthetic campaigns)'],
  [18, 'Closed beta (real DMs)'],
  [19, 'Public launch'],
  [20, 'Contributor portfolios'],
  [21, 'ERC-20 token bridge (planning only)'],
]);

const raw = await readFile(ROADMAP_PATH, 'utf8');
let lines = raw.split('\n');

// Single-pass: shift >= 17 by +2, then apply title rename using the new version number
lines = lines.map(line => {
  const m = line.match(/^###\s+v(\d+)\b/i);
  if (!m) return line;
  let n = parseInt(m[1], 10);
  if (n >= 17) n += 2;
  const newTitle = titleByVersion.get(n);
  if (newTitle) return `### v${n} — ${newTitle}`;
  return line;
});

// Insert new v17 + v18 section headers before the (now-shifted) v19 header
const v19Idx = lines.findIndex(l => /^###\s+v19\b/i.test(l));
if (v19Idx >= 0) {
  lines.splice(
    v19Idx, 0,
    '### v17 — Internal battle-test (synthetic campaigns)',
    '',
    '### v18 — Closed beta (real DMs)',
    '',
  );
}

// Strip all item lines with version tags — we re-emit from DB next
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
