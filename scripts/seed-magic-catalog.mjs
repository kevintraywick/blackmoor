/**
 * Seed the magic_catalog table with SRD 5.1 spells (cantrip–3rd level),
 * corresponding scrolls, and all SRD 5.1 magic items from Open5e v2.
 *
 * Usage:  node scripts/seed-magic-catalog.mjs
 * Requires DATABASE_URL env var (reads from .env.local if present).
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local if present
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
  console.error('DATABASE_URL not found in environment or .env.local');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const OPEN5E = 'https://api.open5e.com/v2';
const DOC_FILTER = 'document__key__in=srd-2014';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchAllPages(baseUrl) {
  const results = [];
  let url = baseUrl;
  while (url) {
    process.stdout.write('.');
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Open5e ${res.status}: ${url}`);
    const data = await res.json();
    results.push(...(data.results ?? []));
    url = data.next;
  }
  return results;
}

function normalizeSpell(s) {
  const components = [];
  if (s.verbal) components.push('V');
  if (s.somatic) components.push('S');
  if (s.material) components.push(s.material_specified ? `M (${s.material_specified})` : 'M');

  return {
    key: s.key,
    name: s.name,
    description: s.desc + (s.higher_level ? `\n\nAt Higher Levels. ${s.higher_level}` : ''),
    metadata: {
      level: s.level ?? 0,
      school: s.school?.name ?? '',
      casting_time: s.casting_time ?? '',
      range: s.range_text ?? '',
      components: components.join(', '),
      duration: (s.concentration ? 'Concentration, ' : '') + (s.duration ?? ''),
      ritual: !!s.ritual,
    },
  };
}

function normalizeItem(item) {
  return {
    key: item.key,
    name: item.name,
    description: item.desc ?? '',
    metadata: {
      category: item.category?.name ?? '',
      rarity: item.rarity?.name ?? '',
      requires_attunement: !!item.requires_attunement,
    },
  };
}

async function upsert(category, entry) {
  const metaStr = JSON.stringify(entry.metadata);
  await pool.query(
    `INSERT INTO magic_catalog (id, category, name, api_key, description, metadata)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
     ON CONFLICT (category, api_key) WHERE api_key IS NOT NULL
     DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
                   metadata = EXCLUDED.metadata,
                   created_at = (EXTRACT(EPOCH FROM now())::bigint)`,
    [category, entry.name, entry.key, entry.description, metaStr]
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding magic catalog from Open5e (SRD 5.1)...\n');

  // 1. Spells: cantrips (level 0) through 3rd level
  console.log('── Spells (cantrip–3rd level) ──');
  const allSpells = [];
  for (const level of [0, 1, 2, 3]) {
    const label = level === 0 ? 'cantrips' : `level ${level}`;
    process.stdout.write(`  ${label} `);
    const spells = await fetchAllPages(
      `${OPEN5E}/spells/?level=${level}&${DOC_FILTER}&format=json&limit=50`
    );
    console.log(` ${spells.length}`);
    allSpells.push(...spells);
  }
  console.log(`  total: ${allSpells.length} spells\n`);

  process.stdout.write('Inserting spells');
  let spellCount = 0;
  for (const s of allSpells) {
    const norm = normalizeSpell(s);
    await upsert('spell', norm);
    spellCount++;
    if (spellCount % 20 === 0) process.stdout.write('.');
  }
  console.log(` ✓ ${spellCount}`);

  // 2. Scrolls: same spells as "Scroll of [Name]"
  process.stdout.write('Inserting scrolls');
  let scrollCount = 0;
  for (const s of allSpells) {
    const norm = normalizeSpell(s);
    await upsert('scroll', {
      ...norm,
      key: `scroll:${norm.key}`,
      name: `Scroll of ${norm.name}`,
    });
    scrollCount++;
    if (scrollCount % 20 === 0) process.stdout.write('.');
  }
  console.log(` ✓ ${scrollCount}`);

  // 3. Magic Items (SRD 5.1)
  console.log('\n── Magic Items ──');
  process.stdout.write('  fetching');
  const items = await fetchAllPages(
    `${OPEN5E}/items/?is_magic_item=true&${DOC_FILTER}&format=json&limit=50`
  );
  console.log(` ${items.length} items\n`);

  process.stdout.write('Inserting items');
  let itemCount = 0;
  for (const item of items) {
    const norm = normalizeItem(item);
    await upsert('magic_item', norm);
    itemCount++;
    if (itemCount % 20 === 0) process.stdout.write('.');
  }
  console.log(` ✓ ${itemCount}`);

  // Summary
  const rows = (await pool.query(
    `SELECT category, COUNT(*)::int as n FROM magic_catalog GROUP BY category ORDER BY category`
  )).rows;
  const total = rows.reduce((sum, r) => sum + r.n, 0);

  console.log(`\n══ Done ══`);
  console.log(`Total catalog entries: ${total}`);
  for (const r of rows) console.log(`  ${r.category}: ${r.n}`);

  await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  pool.end();
  process.exit(1);
});
