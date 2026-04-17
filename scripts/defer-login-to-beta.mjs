/**
 * One-off: defer login items from v6 to v21 (Closed beta).
 *
 * Before real beta DMs, Shadow is the only campaign and Kevin is the
 * only DM — no auth surface needed. v6 keeps just the dms table
 * schema (prerequisite for v7 multi-tenancy); login lands in v21
 * where it matters.
 *
 * Also renames the "Magic-link login via Resend" item to a
 * decision-deferring "review options" title.
 *
 * Run once: node scripts/defer-login-to-beta.mjs
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

// Rename "Magic-link login via Resend" to keep options open
await pool.query(
  `UPDATE roadmap_items
   SET title = 'Login system — decide between magic link / OAuth / passkey (review before build)',
       version = 21,
       sort_order = 5
   WHERE version = 6 AND title = 'Magic-link login via Resend'`,
);

// Move the other three login items to v21 at sort_orders 6, 7, 8
const toMove = [
  { title: '`/login` page', sort_order: 6 },
  { title: '`/dms/[handle]` stub (logged-in only)', sort_order: 7 },
  { title: 'Signup allowlist gate (env-var)', sort_order: 8 },
];
for (const m of toMove) {
  const r = await pool.query(
    `UPDATE roadmap_items SET version = 21, sort_order = $1 WHERE version = 6 AND title = $2`,
    [m.sort_order, m.title],
  );
  if (r.rowCount === 0) {
    console.warn(`WARN: did not find "${m.title}" at v6`);
  }
}

const { rows } = await pool.query(
  `SELECT version, title, sort_order FROM roadmap_items WHERE version IN (6, 21) ORDER BY version, sort_order`,
);
console.log('v6 + v21 after move:');
for (const row of rows) {
  console.log(`  v${row.version} #${row.sort_order} — ${row.title}`);
}

await pool.end();
