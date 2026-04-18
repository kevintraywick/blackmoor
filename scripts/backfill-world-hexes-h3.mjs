/**
 * One-off: backfill `world_hexes.h3_cell` + `h3_res` from legacy (q,r)
 * coordinates using the Shadow world anchor (Blaen Hafren, res 6).
 *
 * Mapping logic mirrors lib/world-hex-mapping.ts verbatim — duplicated
 * here so the script has zero TS import friction. If you change stride
 * constants in the library, mirror them in this script before re-running.
 *
 * Idempotent — only updates rows where h3_cell IS NULL. Safe to re-run.
 * Aborts before writing if any collision would violate uniqueness.
 *
 * Run once: node scripts/backfill-world-hexes-h3.mjs
 */

import pg from 'pg';
import * as h3 from 'h3-js';
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

// Blaen Hafren anchor — must match lib/world-anchor.ts
const LAT0 = 52.4833;
const LNG0 = -3.7333;
const RES = 6;

// Stride constants — must match lib/world-hex-mapping.ts
const COL_STRIDE_KM = 6.50;
const ROW_STRIDE_KM = 7.51;
const ODD_COL_Y_OFFSET_KM = 3.76;
const KM_PER_DEG_LAT = 111;
const KM_PER_DEG_LNG = 111 * Math.cos(LAT0 * Math.PI / 180);

function qrToH3Cell(q, r) {
  const isOdd = ((q % 2) + 2) % 2 === 1;
  const x_km = q * COL_STRIDE_KM;
  const y_km = r * ROW_STRIDE_KM + (isOdd ? ODD_COL_Y_OFFSET_KM : 0);
  const lat = LAT0 - y_km / KM_PER_DEG_LAT;
  const lng = LNG0 + x_km / KM_PER_DEG_LNG;
  return h3.latLngToCell(lat, lng, RES);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

// Load ALL hexes (not just nulls) so we can detect collisions against any
// existing h3_cell values too.
const { rows: all } = await pool.query(
  `SELECT q, r, h3_cell::text AS existing FROM world_hexes ORDER BY q, r`,
);

// Pre-flight: compute cells, check for collisions, and find the write set
const seen = new Map(); // cellHex -> { q, r }
const toWrite = [];
let collisions = 0;
let alreadySet = 0;

for (const { q, r, existing } of all) {
  const cell = qrToH3Cell(q, r);
  if (seen.has(cell)) {
    const prior = seen.get(cell);
    console.error(`collision: (${q},${r}) and (${prior.q},${prior.r}) both → ${cell}`);
    collisions++;
    continue;
  }
  seen.set(cell, { q, r });
  if (existing !== null) {
    alreadySet++;
    continue;
  }
  toWrite.push({ q, r, bigint: BigInt('0x' + cell).toString() });
}

if (collisions > 0) {
  console.error(`\nABORT — ${collisions} collision(s) detected. Tune stride constants in lib/world-hex-mapping.ts and re-run.`);
  await pool.end();
  process.exit(1);
}

console.log(`hexes total: ${all.length}`);
console.log(`  already set: ${alreadySet}`);
console.log(`  to write:    ${toWrite.length}`);
console.log(`  collisions:  ${collisions}`);

if (toWrite.length === 0) {
  console.log('nothing to do — all rows already have h3_cell.');
  await pool.end();
  process.exit(0);
}

// Single transaction
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const { q, r, bigint } of toWrite) {
    await client.query(
      `UPDATE world_hexes SET h3_cell = $1, h3_res = $2 WHERE q = $3 AND r = $4 AND h3_cell IS NULL`,
      [bigint, RES, q, r],
    );
  }
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}

const { rows: after } = await pool.query(
  `SELECT COUNT(*)::int AS total, COUNT(h3_cell)::int AS with_h3 FROM world_hexes`,
);
console.log('after:', after[0]);

await pool.end();
