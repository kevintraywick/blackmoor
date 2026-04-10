/**
 * Seed the magic_catalog table with SRD 2024 (5.2) reference data from Open5e v2.
 * Categories: spells (all levels), scrolls, magic items, weapons, armor, tools.
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
const DOC = 'document__key=srd-2024';

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

function normalizeMagicItem(item) {
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

function normalizeWeapon(item) {
  const w = item.weapon ?? {};
  const props = (w.properties ?? []).map(p => p.property?.name).filter(Boolean);
  return {
    key: item.key,
    name: item.name,
    description: item.desc ?? '',
    metadata: {
      damage_dice: w.damage_dice ?? '',
      damage_type: w.damage_type?.name ?? '',
      properties: props.join(', '),
      is_martial: !!w.is_martial,
      cost: item.cost ?? 0,
      weight: item.weight ?? 0,
    },
  };
}

function normalizeArmor(item) {
  const a = item.armor ?? {};
  return {
    key: item.key,
    name: item.name,
    description: item.desc ?? '',
    metadata: {
      base_ac: a.base_ac ?? null,
      ac_cap: a.ac_cap ?? null,
      strength_requirement: a.strength_requirement ?? null,
      stealth_disadvantage: !!a.stealth_disadvantage,
      cost: item.cost ?? 0,
      weight: item.weight ?? 0,
    },
  };
}

function normalizeTool(item) {
  return {
    key: item.key,
    name: item.name,
    description: item.desc ?? '',
    metadata: {
      cost: item.cost ?? 0,
      weight: item.weight ?? 0,
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
  console.log('Seeding magic catalog from Open5e (SRD 2024 / 5.2)...\n');

  // 1. Spells — all levels
  console.log('── Spells (all levels) ──');
  process.stdout.write('  fetching');
  const allSpells = await fetchAllPages(
    `${OPEN5E}/spells/?${DOC}&format=json&limit=50`
  );
  console.log(` ${allSpells.length} spells\n`);

  process.stdout.write('Inserting spells');
  let spellCount = 0;
  for (const s of allSpells) {
    await upsert('spell', normalizeSpell(s));
    spellCount++;
    if (spellCount % 20 === 0) process.stdout.write('.');
  }
  console.log(` done ${spellCount}`);

  // 2. Scrolls — same spells as "Scroll of [Name]", levels 0-3
  const scrollSpells = allSpells.filter(s => (s.level ?? 0) <= 3);
  process.stdout.write('Inserting scrolls');
  let scrollCount = 0;
  for (const s of scrollSpells) {
    const norm = normalizeSpell(s);
    await upsert('scroll', {
      ...norm,
      key: `scroll:${norm.key}`,
      name: `Scroll of ${norm.name}`,
    });
    scrollCount++;
    if (scrollCount % 20 === 0) process.stdout.write('.');
  }
  console.log(` done ${scrollCount}`);

  // 3. Magic Items
  console.log('\n── Magic Items ──');
  process.stdout.write('  fetching');
  const magicItems = await fetchAllPages(
    `${OPEN5E}/items/?is_magic_item=true&${DOC}&format=json&limit=50`
  );
  console.log(` ${magicItems.length} items\n`);

  process.stdout.write('Inserting magic items');
  let magicCount = 0;
  for (const item of magicItems) {
    await upsert('magic_item', normalizeMagicItem(item));
    magicCount++;
    if (magicCount % 20 === 0) process.stdout.write('.');
  }
  console.log(` done ${magicCount}`);

  // 4. Weapons (non-magic)
  console.log('\n── Weapons ──');
  process.stdout.write('  fetching');
  const allNonMagic = await fetchAllPages(
    `${OPEN5E}/items/?is_magic_item=false&${DOC}&format=json&limit=50`
  );
  const weapons = allNonMagic.filter(i => i.category?.key === 'weapon');
  console.log(` ${weapons.length} weapons\n`);

  process.stdout.write('Inserting weapons');
  let weaponCount = 0;
  for (const item of weapons) {
    await upsert('weapon', normalizeWeapon(item));
    weaponCount++;
  }
  console.log(` done ${weaponCount}`);

  // 5. Armor (non-magic)
  const armorItems = allNonMagic.filter(i => i.category?.key === 'armor' || i.category?.key === 'shield');
  console.log(`\n── Armor ── (${armorItems.length})`);
  process.stdout.write('Inserting armor');
  let armorCount = 0;
  for (const item of armorItems) {
    await upsert('armor', normalizeArmor(item));
    armorCount++;
  }
  console.log(` done ${armorCount}`);

  // 6. Tools (includes musical instruments)
  const tools = allNonMagic.filter(i => i.category?.key === 'tools');
  console.log(`\n── Tools ── (${tools.length})`);
  process.stdout.write('Inserting tools');
  let toolCount = 0;
  for (const item of tools) {
    await upsert('tool', normalizeTool(item));
    toolCount++;
  }
  console.log(` done ${toolCount}`);

  // Summary
  const rows = (await pool.query(
    `SELECT category, COUNT(*)::int as n FROM magic_catalog GROUP BY category ORDER BY category`
  )).rows;
  const total = rows.reduce((sum, r) => sum + r.n, 0);

  console.log(`\n== Done ==`);
  console.log(`Total catalog entries: ${total}`);
  for (const r of rows) console.log(`  ${r.category}: ${r.n}`);

  await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  pool.end();
  process.exit(1);
});
