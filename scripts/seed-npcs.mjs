#!/usr/bin/env node
// Seed NPC library from Open5e SRD 5.1 monsters API (v2)
// Usage: DATABASE_URL=... node scripts/seed-npcs.mjs

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function fetchMonsters() {
  const all = [];
  let url = 'https://api.open5e.com/v2/creatures/?document__key=srd-2014&page_size=100&format=json';
  while (url) {
    console.log(`Fetching: ${url}`);
    const res = await fetch(url);
    if (!res.ok) { console.error(`API error: ${res.status}`); break; }
    const data = await res.json();
    all.push(...(data.results || []));
    url = data.next || null;
  }
  return all;
}

function formatSpeed(s) {
  if (!s || typeof s !== 'object') return '30 ft.';
  const parts = [];
  if (s.walk) parts.push(`${s.walk} ft.`);
  if (s.fly) parts.push(`fly ${s.fly} ft.`);
  if (s.swim) parts.push(`swim ${s.swim} ft.`);
  if (s.climb) parts.push(`climb ${s.climb} ft.`);
  if (s.burrow) parts.push(`burrow ${s.burrow} ft.`);
  if (s.hover) parts[parts.length - 1] += ' (hover)';
  return parts.join(', ') || '30 ft.';
}

function fmtActions(arr) {
  if (!arr?.length) return '';
  return arr.map(a => `${a.name}: ${a.desc}`).join('\n\n');
}

function isAttack(a) {
  return a.desc && (a.desc.includes('to hit') || a.desc.includes('damage'));
}

function buildNotes(m) {
  const parts = [];
  const size = m.size?.name || '';
  const type = m.type?.name || '';
  const align = m.alignment || '';
  if (size || type) parts.push(`${size} ${type}${align ? `, ${align}` : ''}`);

  const senses = [];
  if (m.darkvision_range) senses.push(`darkvision ${Math.round(m.darkvision_range)} ft.`);
  if (m.blindsight_range) senses.push(`blindsight ${Math.round(m.blindsight_range)} ft.`);
  if (m.tremorsense_range) senses.push(`tremorsense ${Math.round(m.tremorsense_range)} ft.`);
  if (m.truesight_range) senses.push(`truesight ${Math.round(m.truesight_range)} ft.`);
  if (m.passive_perception) senses.push(`passive Perception ${m.passive_perception}`);
  if (senses.length) parts.push(`Senses: ${senses.join(', ')}`);

  const langs = m.languages?.as_string;
  if (langs) parts.push(`Languages: ${langs}`);

  const abs = m.ability_scores;
  if (abs) {
    parts.push(`STR ${abs.strength} | DEX ${abs.dexterity} | CON ${abs.constitution} | INT ${abs.intelligence} | WIS ${abs.wisdom} | CHA ${abs.charisma}`);
  }

  // Legendary actions
  const legendary = (m.actions || []).filter(a => a.action_type === 'LEGENDARY_ACTION');
  if (legendary.length) parts.push('Legendary Actions:\n' + fmtActions(legendary));

  // Reactions
  const reactions = (m.actions || []).filter(a => a.action_type === 'REACTION');
  if (reactions.length) parts.push('Reactions:\n' + fmtActions(reactions));

  return parts.join('\n\n');
}

async function main() {
  const monsters = await fetchMonsters();
  console.log(`Fetched ${monsters.length} SRD monsters`);

  let inserted = 0, skipped = 0;

  for (const m of monsters) {
    const name = m.name || '';
    if (!name) continue;

    const id = `srd-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`;

    const existing = await pool.query('SELECT id FROM npcs WHERE id = $1 OR LOWER(name) = LOWER($2)', [id, name]);
    if (existing.rows.length > 0) { skipped++; continue; }

    const cr = m.challenge_rating_text || '';
    const hp_roll = m.hit_dice || '';
    const acDetail = m.armor_detail ? ` (${m.armor_detail})` : '';
    const ac = m.armor_class ? `${m.armor_class}${acDetail}` : '';
    const speed = formatSpeed(m.speed);

    const size = m.size?.name || '';
    const type = m.type?.name || '';
    const sub = m.subcategory || '';
    const species = sub ? `${size} ${type} (${sub})` : `${size} ${type}`;

    const allActions = m.actions || [];
    const regularActions = allActions.filter(a => a.action_type === 'ACTION');
    const attacks = fmtActions(regularActions.filter(isAttack));
    const nonAttackActions = fmtActions(regularActions.filter(a => !isAttack(a)));
    const traits = fmtActions(m.traits || []);
    const notes = buildNotes(m);

    try {
      await pool.query(
        `INSERT INTO npcs (id, name, species, cr, hp, hp_roll, ac, speed, attacks, traits, actions, notes)
         VALUES ($1, $2, $3, $4, '', $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [id, name, species, cr, hp_roll, ac, speed, attacks, traits, nonAttackActions, notes]
      );
      inserted++;
      if (inserted % 50 === 0) console.log(`  Inserted ${inserted}...`);
    } catch (err) {
      console.error(`Failed: ${name}: ${err.message}`);
    }
  }

  console.log(`Done. Inserted ${inserted}, skipped ${skipped}`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
