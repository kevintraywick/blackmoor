/**
 * One-off: integrate Phase 2 brainstorm into the roadmap.
 *
 * Changes:
 *   1. Split v12 (Living world + economy) — move 4 economy items to new v13.
 *   2. Insert two new versions:
 *      - v14 "Magic system + MP economy"
 *      - v16 "Steampunk + airships"
 *   3. Shift old v13+ upward to make room:
 *        13→15, 14→17, 15→18, 16→19, 17→20, 18→21, 19→22, 20→23, 21→24
 *   4. Add ~30 new items across v7, v9, v10, v11, v12, v14, v15, v16, v19, v23.
 *   5. Rename v12 to "Living world (entities + agents)" (economy split out).
 *   6. Rewrite ROADMAP.md with new section titles + regenerated items.
 *
 * Run once: node scripts/integrate-brainstorm.mjs
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

// 1. Shift versions 13..21 per per-version mapping. Process descending to avoid collisions.
const shifts = [
  [21, 24], [20, 23], [19, 22], [18, 21], [17, 20],
  [16, 19], [15, 18], [14, 17], [13, 15],
];
for (const [oldV, newV] of shifts) {
  await pool.query('UPDATE roadmap_items SET version = $1 WHERE version = $2', [newV, oldV]);
}
console.log('shifted versions 13..21 to new slots');

// 2. Move 4 economy items from v12 to new v13
const economyTitles = [
  '`treasury_gp` / `treasury_sp` / `treasury_cp` on campaigns',
  'Upkeep ledger + debit per common-day',
  'Common item price sheet (`/common-world/prices`)',
  '`/dm/[slug]/treasury` page',
];
let econOrder = 10;
for (const title of economyTitles) {
  const result = await pool.query(
    'UPDATE roadmap_items SET version = 13, sort_order = $1 WHERE version = 12 AND title = $2',
    [econOrder, title],
  );
  if (result.rowCount === 0) {
    console.warn(`WARN: could not find economy item "${title}" at v12`);
  }
  econOrder += 10;
}
console.log('moved 4 economy items from v12 to v13');

// 3. Insert new items across versions
const adds = [
  // v7 — Campaign scoping
  { v: 7, title: '`pocket_mode` flag on campaigns (opt out of Common World integration)' },
  // v9 — Read-only Common World
  { v: 9, title: 'Seed the twelve astral voids at pentagon cells (named cosmological placeholders)' },
  // v10 — Claim + publish
  { v: 10, title: 'k-ring(N) proximity rule — new DM claims must be adjacent to existing claims' },
  { v: 10, title: 'Chronicler override — undo or negotiate a contested canon mutation after-the-fact' },
  // v11 — Content lifecycle + canon
  { v: 11, title: "Cross-campaign overlap detection + notification (surface when two campaigns' explored hexes intersect)" },
  { v: 11, title: 'Common Year alignment rules (close-in-time campaigns bring-forward to world frontier)' },
  // v12 — Living world (entities + agents)
  { v: 12, title: 'NPC Layer A — ambient/loop NPCs (hex-schedule data model, baker pattern)' },
  { v: 12, title: 'NPC Layer B scaffold — mechanic NPCs (merchants, criers, innkeepers)' },
  { v: 12, title: 'Factions table (thieves, assassins, merchants, religious orders, royalty)' },
  { v: 12, title: 'Faction agents with agendas + pairwise relationships' },
  { v: 12, title: 'Pentagon/void routing — entities route around the twelve voids' },
  { v: 12, title: 'Overheard-on-pass — Layer A NPC proximity triggers SMS/Discord snippet' },
  // v14 — Magic system + MP economy (NEW)
  { v: 14, title: 'MP on player sheet — natural capacity + current held (per-class/race cap)' },
  { v: 14, title: '`vessels` table — owner, type, capacity, current_mp, recharge_rate, condition' },
  { v: 14, title: 'Affinity classification — natural / channeler / mundane on player sheets' },
  { v: 14, title: 'Ley-line hex state — per-hex MP reserves and regeneration' },
  { v: 14, title: 'Per-hex MP pricing + regional gp↔MP exchange rates' },
  { v: 14, title: 'Magic merchants + magic banks (storage, loans, interest)' },
  { v: 14, title: 'Moon-phase recharge modifier on vessels + natural holders' },
  { v: 14, title: 'Wild-magic surge tables (5e-based) + world-consequence variants' },
  // v15 — News, weather, celestial (was v13)
  { v: 15, title: 'NOAA GFS weather subscription → in-fiction storms (identity-laundered)' },
  { v: 15, title: 'NOAA SWPC aurora/solar-flare feed → sky-danced events' },
  { v: 15, title: 'Trust tiers on items (Official / Whispered / Rumored / Prophesied)' },
  { v: 15, title: 'Earth-region remap engine — per-world rotation/mirror/shuffle of real geography' },
  // v16 — Steampunk + airships (NEW)
  { v: 16, title: 'Airship yards as world entities at anchor hexes' },
  { v: 16, title: 'Airship trade routes as world entities (lines between yards)' },
  { v: 16, title: 'MP-burning engine mechanics — vessels power propulsion' },
  { v: 16, title: 'Air-current navigation using laundered real jet-stream data' },
  { v: 16, title: 'Passage-booking flow for player parties (fast travel option)' },
  { v: 16, title: 'Sky-pirates as faction (steampunk air-raid mechanics)' },
  // v19 — Crossover sessions (was v16)
  { v: 19, title: 'Same-location-same-time surfacing (two parties in same hex at same in-fiction time)' },
  // v23 — Contributor portfolios (was v20)
  { v: 23, title: 'NPC Layer C — hero NPCs as long-horizon agents with memory + agendas' },
];

const byV = new Map();
for (const add of adds) {
  const list = byV.get(add.v) ?? [];
  list.push(add);
  byV.set(add.v, list);
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
  console.log(`inserted ${list.length} items at v${v}`);
}

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

const versionShift = new Map(shifts);
const raw = await readFile(ROADMAP_PATH, 'utf8');
let lines = raw.split('\n');

// Single pass: rewrite section headers (apply shift, then apply new title)
lines = lines.map(line => {
  const m = line.match(/^###\s+v(\d+)\b/i);
  if (!m) return line;
  let n = parseInt(m[1], 10);
  if (versionShift.has(n)) n = versionShift.get(n);
  const newTitle = titleByVersion.get(n);
  if (newTitle) return `### v${n} — ${newTitle}`;
  return line;
});

// Insert new section headers for v13 + v14 (before v15) and v16 (before v17)
const v15Idx = lines.findIndex(l => /^###\s+v15\b/i.test(l));
if (v15Idx >= 0) {
  lines.splice(v15Idx, 0,
    '### v13 — Economy — monetary',
    '',
    '### v14 — Magic system + MP economy',
    '',
  );
}
const v17Idx = lines.findIndex(l => /^###\s+v17\b/i.test(l));
if (v17Idx >= 0) {
  lines.splice(v17Idx, 0,
    '### v16 — Steampunk + airships',
    '',
  );
}

// Strip item lines, regenerate from DB
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
