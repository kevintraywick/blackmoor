/**
 * One-off: apply Q4 (agent cost budget) decisions to the roadmap.
 *
 * - v12 #165 (royalty research) → delete; resolved in §11.
 * - v12 #155 (Overheard SMS/Discord) → drop SMS; Twilio pulled per Q4.
 * - v12 #175 (Agent cost budget + kill switch) → keep as headline,
 *   insert concrete implementation items around it:
 *     - hard_cap_usd column + auto-pause at hard cap
 *     - per-call $0.10 cost estimator / rejector
 *     - auto-downgrade Sonnet→Haiku at 50% of hard cap
 *     - campaign-scoped spend caps (depends on v7)
 *     - founder emergency kill-all admin endpoint
 *     - DM-facing World AI pause toggle on /dm/campaign
 *
 * Run once: node scripts/apply-q4-agent-budget.mjs
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

// 1. Drop resolved royalty research item
const delRes = await pool.query(
  `DELETE FROM roadmap_items
   WHERE version = 12
     AND title LIKE 'Research pass: D&D royalty terminology%'`,
);
console.log(`deleted ${delRes.rowCount} royalty item`);

// 2. Drop SMS from Overheard-on-pass — Discord only
const updRes = await pool.query(
  `UPDATE roadmap_items
   SET title = 'Overheard-on-pass — Layer A NPC proximity triggers Discord snippet'
   WHERE version = 12
     AND title = 'Overheard-on-pass — Layer A NPC proximity triggers SMS/Discord snippet'`,
);
console.log(`updated ${updRes.rowCount} overheard item (SMS → Discord)`);

// 3. Insert implementation items around #175 headline.
// Use sort_orders 176-181 so they sit immediately after the headline.
const newItems = [
  { sort_order: 176, title: 'Add `hard_cap_usd` to budget caps — auto-pause when MTD crosses hard cap' },
  { sort_order: 177, title: 'Per-call Anthropic cost estimator — reject calls with estimated cost > $0.10' },
  { sort_order: 178, title: 'Auto-downgrade Sonnet → Haiku when MTD crosses 50% of hard cap' },
  { sort_order: 179, title: 'Campaign-scoped spend caps — ledger + caps keyed on `campaign_id`' },
  { sort_order: 180, title: 'Founder emergency kill-all — admin endpoint pauses every campaign\'s World AI' },
  { sort_order: 181, title: 'World AI pause toggle on `/dm/campaign` — live, campaign-scoped, instant effect' },
];

for (const item of newItems) {
  await pool.query(
    `INSERT INTO roadmap_items (ladder, version, title, status, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    ['common', 12, item.title, 'planned', item.sort_order],
  );
}
console.log(`inserted ${newItems.length} agent-budget items`);

// Dump v12 after
const { rows } = await pool.query(
  `SELECT sort_order, title FROM roadmap_items WHERE version = 12 ORDER BY sort_order`,
);
console.log('\nv12 after:');
for (const r of rows) console.log(`  #${r.sort_order} — ${r.title}`);

await pool.end();
