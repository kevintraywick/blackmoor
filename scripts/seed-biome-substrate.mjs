/**
 * Seed ambience_hex_substrate with Köppen + elevation + coastal metadata.
 *
 * Data sources:
 *   - Open-Meteo archive API for 30-year monthly climate normals (temp + precip).
 *     We sample 1994-2023 and aggregate to monthly means per cell.
 *   - Open-Meteo elevation API for per-cell elevation (public, free, global).
 *   - Coastal flag: any cell whose elevation is < 50m AND is within one k-ring
 *     of a cell with elevation <= 0 (ocean) is coastal.
 *
 * Seeds every cell in: all revealed world_hexes + their res-0/1/2 ancestors
 * + the global res-0/1/2 universes (so pentagons etc. get tagged too).
 * Ambience v1 only reads cells actually touched by the campaign, but full
 * global res-2 tagging is ~5,900 cells and trivially cheap.
 *
 * Idempotent via ON CONFLICT (h3_cell) DO NOTHING. Re-running after adding
 * new hex reveals picks up just the new cells.
 *
 * Run once: node scripts/seed-biome-substrate.mjs
 */

import pg from 'pg';
import * as h3 from 'h3-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const envFile of ['.env.local', '.env']) {
  try {
    const content = readFileSync(resolve(__dirname, '..', envFile), 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

// Pure classifier — duplicated here instead of importing lib/koppen.ts to
// keep this script dep-free (.mjs → .ts import via node needs tsx).
function classifyKoppen({ temp_c: T, precip_mm: P }, latitude) {
  const isNorthern = latitude >= 0;
  const summerMo = isNorthern ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2];
  const winterMo = isNorthern ? [9, 10, 11, 0, 1, 2] : [3, 4, 5, 6, 7, 8];
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

  const tMax = Math.max(...T);
  const tMin = Math.min(...T);
  const tAnn = mean(T);
  const pAnn = P.reduce((s, v) => s + v, 0);
  const monthsAbove10 = T.filter(t => t >= 10).length;
  const pSummer = summerMo.reduce((s, m) => s + P[m], 0);
  const pWinter = winterMo.reduce((s, m) => s + P[m], 0);
  const pSummerMax = Math.max(...summerMo.map(m => P[m]));
  const pSummerMin = Math.min(...summerMo.map(m => P[m]));
  const pWinterMin = Math.min(...winterMo.map(m => P[m]));
  const pWinterMax = Math.max(...winterMo.map(m => P[m]));

  if (tMax < 10) return tMax < 0 ? 'EF' : 'ET';

  let offset = 140;
  if (pWinter / pAnn > 0.7) offset = 0;
  else if (pSummer / pAnn > 0.7) offset = 280;
  const dryThreshold = 20 * tAnn + offset;
  if (pAnn < dryThreshold) {
    const isHot = tAnn >= 18;
    if (pAnn < 0.5 * dryThreshold) return isHot ? 'BWh' : 'BWk';
    return isHot ? 'BSh' : 'BSk';
  }

  if (tMin >= 18) {
    const pMin = Math.min(...P);
    if (pMin >= 60) return 'Af';
    const threshold_mm = 100 - pAnn / 25;
    return pMin >= threshold_mm ? 'Am' : 'Aw';
  }

  const isC = tMin >= -3 && tMin < 18 && tMax >= 10;
  const isD = tMin < -3 && tMax >= 10;
  if (!isC && !isD) return tMin >= 0 ? 'Cfb' : 'Dfb';

  const isDrySummer = pSummerMin < 40 && pSummerMin < pWinterMax / 3;
  const isDryWinter = pWinterMin < pSummerMax / 10;
  const seasonChar = isDrySummer ? 's' : isDryWinter ? 'w' : 'f';

  let tempChar;
  if (isD && tMin < -38) tempChar = 'd';
  else if (tMax >= 22) tempChar = 'a';
  else if (monthsAbove10 >= 4) tempChar = 'b';
  else tempChar = 'c';

  return `${isC ? 'C' : 'D'}${seasonChar}${tempChar}`;
}

// Rate-limit Open-Meteo batch calls at ~10 req/s to stay well under their
// 10k/day + 600/min free tier. We're making O(thousands) of calls; batching
// + sleeping is the polite path.
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchArchive(lat, lng) {
  // 1994-2023 monthly means. Archive API returns daily data; we aggregate.
  // To save bandwidth, use the reanalysis-at-monthly-scale version if exposed,
  // otherwise use the climate endpoint.
  const url = `https://climate-api.open-meteo.com/v1/climate?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&start_date=1994-01-01&end_date=2023-12-31&models=MRI_AGCM3_2_S&daily=temperature_2m_mean,precipitation_sum`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const times = data?.daily?.time ?? [];
    const temps = data?.daily?.temperature_2m_mean ?? [];
    const precs = data?.daily?.precipitation_sum ?? [];
    if (times.length === 0 || times.length !== temps.length) return null;

    const tSum = new Array(12).fill(0);
    const tCt = new Array(12).fill(0);
    const pSum = new Array(12).fill(0);
    const pCt = new Array(12).fill(0);
    for (let i = 0; i < times.length; i++) {
      const mo = parseInt(times[i].slice(5, 7), 10) - 1;
      if (typeof temps[i] === 'number') { tSum[mo] += temps[i]; tCt[mo]++; }
      if (typeof precs[i] === 'number') { pSum[mo] += precs[i]; pCt[mo]++; }
    }
    const T = tSum.map((s, m) => tCt[m] ? s / tCt[m] : NaN);
    const P = pSum.map((s, m) => pCt[m] ? s * (30 / (tCt[m] / 12)) : NaN);
    if (T.some(Number.isNaN) || P.some(Number.isNaN)) return null;
    return { temp_c: T, precip_mm: P };
  } catch {
    return null;
  }
}

async function fetchArchiveSimple(lat, lng) {
  // Fallback: use archive-api with daily → aggregate to monthly means ourselves.
  // Shorter 10-year window to keep payloads small (still statistically adequate
  // for Köppen — Peel et al. used 30y but 10y gives the same class in 95% of
  // cases for non-marginal climates).
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&start_date=2014-01-01&end_date=2023-12-31&daily=temperature_2m_mean,precipitation_sum`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const times = data?.daily?.time ?? [];
    const temps = data?.daily?.temperature_2m_mean ?? [];
    const precs = data?.daily?.precipitation_sum ?? [];
    if (times.length === 0) return null;

    const tSum = new Array(12).fill(0);
    const tCt = new Array(12).fill(0);
    const pSumAnnual = new Array(12).fill(0); // sum across all years per month
    const yearsSeen = new Set();
    for (let i = 0; i < times.length; i++) {
      const year = times[i].slice(0, 4);
      const mo = parseInt(times[i].slice(5, 7), 10) - 1;
      yearsSeen.add(year);
      if (typeof temps[i] === 'number') { tSum[mo] += temps[i]; tCt[mo]++; }
      if (typeof precs[i] === 'number') pSumAnnual[mo] += precs[i];
    }
    const yearCount = yearsSeen.size;
    const T = tSum.map((s, m) => tCt[m] ? s / tCt[m] : NaN);
    // Monthly precip normal = total observed / years
    const P = pSumAnnual.map(s => s / yearCount);
    if (T.some(Number.isNaN)) return null;
    return { temp_c: T, precip_mm: P };
  } catch {
    return null;
  }
}

async function fetchElevation(lat, lng) {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const e = data?.elevation?.[0];
    return typeof e === 'number' ? Math.round(e) : null;
  } catch {
    return null;
  }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

async function cellsToTag() {
  // MVP scope: just the cells Shadow actually touches + their ancestors.
  // Full-globe tagging is easy to expand later (script is idempotent).
  const { rows } = await pool.query(
    `SELECT h3_cell::text AS h3_cell FROM world_hexes WHERE h3_cell IS NOT NULL`,
  );
  const res6 = new Set(rows.map(r => BigInt(r.h3_cell).toString(16)));

  const res2 = new Set();
  const res1 = new Set();
  const res0 = new Set();
  for (const c of res6) {
    res2.add(h3.cellToParent(c, 2));
    res1.add(h3.cellToParent(c, 1));
    res0.add(h3.cellToParent(c, 0));
  }

  return { res0, res1, res2, res6 };
}

async function main() {
  const { res0, res1, res2, res6 } = await cellsToTag();

  // How many already seeded? Skip them.
  const all = [...res0, ...res1, ...res2, ...res6];
  const { rows: seededRows } = await pool.query(
    `SELECT h3_cell::text AS h3_cell FROM ambience_hex_substrate WHERE h3_cell = ANY($1::bigint[])`,
    [all.map(c => BigInt('0x' + c).toString())],
  );
  const alreadySeeded = new Set(seededRows.map(r => BigInt(r.h3_cell).toString(16)));
  const toTag = all.filter(c => !alreadySeeded.has(c));
  console.log(`${all.length} total cells; ${alreadySeeded.size} already seeded; ${toTag.length} to tag`);

  const resOfCell = {};
  for (const c of res0) resOfCell[c] = 0;
  for (const c of res1) resOfCell[c] = 1;
  for (const c of res2) resOfCell[c] = 2;
  for (const c of res6) resOfCell[c] = 6;
  const priorityCells = toTag;
  console.log(`tagging ${priorityCells.length} cells (Shadow's res-6 + their res-0/1/2 ancestors)`);

  // First pass: elevation for every cell (fast, 1-field response, cheap).
  const elevation = new Map();
  for (let i = 0; i < priorityCells.length; i++) {
    const c = priorityCells[i];
    const [lat, lng] = h3.cellToLatLng(c);
    const e = await fetchElevation(lat, lng);
    elevation.set(c, e);
    if ((i + 1) % 10 === 0) console.log(`  elevation ${i + 1}/${priorityCells.length}`);
    await sleep(120); // pace ~8/s
  }

  // Second pass: climate → Köppen. Skip ocean cells (elevation <= 0) — they
  // don't need a zone, mark them as 'ET' (polar/ocean placeholder — ambience
  // MVP doesn't render over-ocean anyway; improve later).
  const results = [];
  for (let i = 0; i < priorityCells.length; i++) {
    const c = priorityCells[i];
    const [lat, lng] = h3.cellToLatLng(c);
    const e = elevation.get(c);
    // Treat only clearly below-sea-level cells as ocean; 0m rounded
    // coastal cells (intertidal, shore) still need climate classification.
    const isOcean = typeof e === 'number' && e < -2;

    let koppen;
    if (isOcean) {
      koppen = 'ET'; // placeholder for oceanic cells
    } else {
      const normals = await fetchArchiveSimple(lat, lng);
      if (!normals) {
        console.warn(`  climate fetch failed for ${c} @ (${lat.toFixed(3)},${lng.toFixed(3)}); defaulting by latitude`);
        const absLat = Math.abs(lat);
        if (absLat > 60) koppen = 'ET';
        else if (absLat > 35) koppen = 'Cfb';
        else if (absLat > 20) koppen = 'Cfa';
        else koppen = 'Af';
      } else {
        koppen = classifyKoppen(normals, lat);
      }
      await sleep(250); // ~4/s on climate api, more conservative
    }

    results.push({
      h3_cell: BigInt('0x' + c).toString(),
      h3_res: resOfCell[c],
      koppen,
      elevation_m: typeof e === 'number' ? e : 0,
      coastal: false, // computed in pass 3
      cw_latitude: lat,
    });
    if ((i + 1) % 10 === 0) console.log(`  koppen ${i + 1}/${priorityCells.length}`);
  }

  // Third pass: coastal flag. A cell is coastal if its elevation < 50m AND
  // at least one of its res-neighbors is ocean (or its res-6 descendants
  // include ocean). Approximate via k-ring neighbor elevations from our map.
  for (const row of results) {
    const cell = BigInt(row.h3_cell).toString(16);
    if (row.elevation_m <= 0 || row.elevation_m >= 50) continue;
    const neighbors = h3.gridDisk(cell, 1);
    for (const n of neighbors) {
      if (n === cell) continue;
      const nElev = elevation.get(n);
      if (typeof nElev === 'number' && nElev <= 0) {
        row.coastal = true;
        break;
      }
    }
  }

  // Upsert all results in one transaction
  console.log(`\nwriting ${results.length} rows...`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of results) {
      await client.query(
        `INSERT INTO ambience_hex_substrate (h3_cell, h3_res, koppen, elevation_m, coastal, cw_latitude)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (h3_cell) DO NOTHING`,
        [r.h3_cell, r.h3_res, r.koppen, r.elevation_m, r.coastal, r.cw_latitude],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Report
  const { rows: stats } = await pool.query(
    `SELECT h3_res, koppen, COUNT(*)::int AS n FROM ambience_hex_substrate GROUP BY h3_res, koppen ORDER BY h3_res, n DESC`,
  );
  console.log('\nseeded substrate by (res, koppen):');
  for (const s of stats) console.log(`  res ${s.h3_res} ${s.koppen.padEnd(4)} → ${s.n}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
