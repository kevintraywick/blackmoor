/**
 * One-off: seed the Anna B. Meyer Flanaess Map 41 as a regional map.
 *
 * Creates:
 *   - map_builds row with map_role='regional', mirror_horizontal=true
 *   - Two regional_map_anchors rows:
 *       Pearl Beacon → Aberystwyth
 *       Delaric      → Blaen Hafren (= Shadow's world anchor)
 *   - Copies the source JPG into BUILDER_IMAGES_DIR with a uuid filename
 *
 * Idempotent on re-run: looks for an existing map_builds row by name and
 * exits early if found (so re-running won't dupe). To force re-seed,
 * delete the row + anchor rows manually first.
 *
 * SPLIT-BRAIN NOTE (2026-04-25): local dev shares prod DB. The image file
 * goes only to local DATA_DIR, so the deployed Railway service won't be
 * able to serve it until we sync. See memory:
 * project_split_brain_post_prototype.md.
 *
 * Run once: node scripts/seed-flanaess-map-41.mjs
 */

import pg from 'pg';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .env.local
for (const envFile of ['.env.local', '.env']) {
  try {
    const envPath = resolve(__dirname, '..', envFile);
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

const SOURCE_JPG = '/Users/moon/Desktop/D&D/maps/Flanaess_Map 41_Atlas 2022 11x17_annabmeyer.jpg';
const BUILDER_IMAGES_DIR =
  process.env.BUILDER_IMAGES_DIR ?? `${process.env.DATA_DIR ?? '/data'}/builder-images`;

const MAP_NAME = 'Flanaess Map 41';
const IMAGE_W = 3376;
const IMAGE_H = 5176;

// Real-world coords
const ABERYSTWYTH = { lat: 52.4140, lng: -4.0810 };
const BLAEN_HAFREN = { lat: 52.4833, lng: -3.7333 }; // matches lib/world-anchor-constants.ts

// Visual estimates on the 3376×5176 image (refine via UI later).
const PEARL_BEACON_PX = { x: 2270, y: 1550 };
const DELARIC_PX = { x: 770, y: 1190 };

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function main() {
  // 0. Apply the new DDL up front — ensureSchema in lib/schema.ts is
  // memoized, and the seed script doesn't hit an app route, so the new
  // columns/tables won't exist yet on a fresh shared DB. Idempotent.
  await pool.query(
    `ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS mirror_horizontal BOOLEAN NOT NULL DEFAULT false`,
  );
  // Old CHECK constraint excluded 'regional' — swap it for the new one.
  await pool.query(
    `ALTER TABLE map_builds DROP CONSTRAINT IF EXISTS map_builds_map_role_check`,
  );
  await pool.query(
    `ALTER TABLE map_builds ADD CONSTRAINT map_builds_map_role_check
     CHECK (map_role IN ('local_map', 'world_addition', 'regional'))`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS regional_map_anchors (
      id            TEXT PRIMARY KEY,
      build_id      TEXT NOT NULL REFERENCES map_builds(id) ON DELETE CASCADE,
      feature_name  TEXT NOT NULL,
      image_px_x    INTEGER,
      image_px_y    INTEGER,
      real_lat      DOUBLE PRECISION NOT NULL,
      real_lng      DOUBLE PRECISION NOT NULL,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    BIGINT NOT NULL
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS regional_map_anchors_build_idx ON regional_map_anchors (build_id)`,
  );

  // 1. Already seeded?
  const existing = await pool.query(
    `SELECT id FROM map_builds WHERE name = $1 AND map_role = 'regional' LIMIT 1`,
    [MAP_NAME],
  );
  if (existing.rows.length > 0) {
    console.log(`Already seeded: build_id=${existing.rows[0].id}. Skipping.`);
    await pool.end();
    return;
  }

  // 2. Copy the JPG into BUILDER_IMAGES_DIR
  if (!existsSync(SOURCE_JPG)) {
    console.error(`Source JPG not found: ${SOURCE_JPG}`);
    process.exit(1);
  }
  const buf = readFileSync(SOURCE_JPG);
  const filename = `${randomUUID()}.jpg`;
  mkdirSync(BUILDER_IMAGES_DIR, { recursive: true });
  writeFileSync(resolve(BUILDER_IMAGES_DIR, filename), buf);
  console.log(`Copied JPG → ${BUILDER_IMAGES_DIR}/${filename} (${(buf.byteLength / 1024 / 1024).toFixed(2)} MB)`);

  // 3. Insert map_builds row
  const buildId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await pool.query(
    `INSERT INTO map_builds
       (id, name, session_id, map_role, mirror_horizontal,
        image_path, image_width_px, image_height_px,
        created_at, updated_at)
     VALUES ($1, $2, NULL, 'regional', true, $3, $4, $5, $6, $6)`,
    [buildId, MAP_NAME, filename, IMAGE_W, IMAGE_H, now],
  );
  console.log(`Inserted map_builds row: ${buildId}`);

  // 4. Insert two anchor rows
  for (const [i, a] of [
    {
      feature: 'Pearl Beacon',
      px: PEARL_BEACON_PX,
      real: ABERYSTWYTH,
    },
    {
      feature: 'Delaric',
      px: DELARIC_PX,
      real: BLAEN_HAFREN,
    },
  ].entries()) {
    await pool.query(
      `INSERT INTO regional_map_anchors
         (id, build_id, feature_name, image_px_x, image_px_y,
          real_lat, real_lng, sort_order, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [randomUUID(), buildId, a.feature, a.px.x, a.px.y, a.real.lat, a.real.lng, i, now],
    );
    console.log(`Anchor: ${a.feature.padEnd(14)} px=(${a.px.x}, ${a.px.y}) → real=(${a.real.lat}, ${a.real.lng})`);
  }

  // 5. Predict where a few other named features land, as a sanity check.
  // Math: mirror x then linear interp from the two anchors.
  const x1p = IMAGE_W - PEARL_BEACON_PX.x;
  const x2p = IMAGE_W - DELARIC_PX.x;
  const lngPerPx = (BLAEN_HAFREN.lng - ABERYSTWYTH.lng) / (x2p - x1p);
  const latPerPx = (BLAEN_HAFREN.lat - ABERYSTWYTH.lat) / (DELARIC_PX.y - PEARL_BEACON_PX.y);
  const predict = (px, py) => {
    const xp = IMAGE_W - px;
    return {
      lat: ABERYSTWYTH.lat + latPerPx * (py - PEARL_BEACON_PX.y),
      lng: ABERYSTWYTH.lng + lngPerPx * (xp - x1p),
    };
  };
  console.log('');
  console.log('Sanity check — predicted lat/lng for visual-estimate px coords:');
  // Roland is just north of Pearl Beacon on the east coast — eyeball ≈ (2280, 1380)
  const roland = predict(2280, 1380);
  // Winetha is north of Pearl Beacon — eyeball ≈ (2350, 1080)
  const winetha = predict(2350, 1080);
  console.log(`  Roland   ≈ (${roland.lat.toFixed(4)}, ${roland.lng.toFixed(4)})`);
  console.log(`  Winetha  ≈ (${winetha.lat.toFixed(4)}, ${winetha.lng.toFixed(4)})`);

  await pool.end();
  console.log('');
  console.log('Done. Build ID:', buildId);
  console.log('Source JPG kept at:', SOURCE_JPG);
  console.log('Local copy at:', resolve(BUILDER_IMAGES_DIR, filename));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
