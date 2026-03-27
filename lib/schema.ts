// Run this once to create database tables.
// Called automatically on first API request if tables don't exist.
import { pool } from './db';
import { PLAYERS } from './players';
import { lookupNpcImage } from './npc-images';

// Memoize across the process lifetime — avoids DDL round-trip on every request
let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = _initSchema();
  return schemaReady;
}

async function _initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      number      INTEGER NOT NULL DEFAULT 0,
      title       TEXT NOT NULL DEFAULT '',
      date        TEXT NOT NULL DEFAULT '',
      goal        TEXT NOT NULL DEFAULT '',
      scenes      TEXT NOT NULL DEFAULT '',
      npcs        TEXT NOT NULL DEFAULT '',
      locations   TEXT NOT NULL DEFAULT '',
      loose_ends  TEXT NOT NULL DEFAULT '',
      notes       TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      last_modified BIGINT NOT NULL DEFAULT 0
    )
  `);

  // Player sheets — one row per player, gear stored as JSONB array
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_sheets (
      id             TEXT PRIMARY KEY,
      discord        TEXT NOT NULL DEFAULT '',
      species        TEXT NOT NULL DEFAULT '',
      class          TEXT NOT NULL DEFAULT '',
      level          TEXT NOT NULL DEFAULT '',
      hp             TEXT NOT NULL DEFAULT '',
      xp             TEXT NOT NULL DEFAULT '',
      speed          TEXT NOT NULL DEFAULT '',
      size           TEXT NOT NULL DEFAULT '',
      ac             TEXT NOT NULL DEFAULT '',
      boons          TEXT NOT NULL DEFAULT '',
      class_features TEXT NOT NULL DEFAULT '',
      species_traits TEXT NOT NULL DEFAULT '',
      player_notes   TEXT NOT NULL DEFAULT '',
      general_notes  TEXT NOT NULL DEFAULT '',
      gear           JSONB NOT NULL DEFAULT '[]'
    )
  `);

  // Add spells column if it doesn't exist yet (safe migration)
  await pool.query(`
    ALTER TABLE player_sheets
    ADD COLUMN IF NOT EXISTS spells JSONB NOT NULL DEFAULT '[]'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS maps (
      id              TEXT PRIMARY KEY,
      session_id      TEXT NOT NULL,
      name            TEXT NOT NULL DEFAULT '',
      image_path      TEXT NOT NULL DEFAULT '',
      grid_type       TEXT NOT NULL DEFAULT 'square',
      cols            INTEGER NOT NULL DEFAULT 20,
      rows            INTEGER NOT NULL DEFAULT 15,
      offset_x        DOUBLE PRECISION NOT NULL DEFAULT 0,
      offset_y        DOUBLE PRECISION NOT NULL DEFAULT 0,
      tile_px         DOUBLE PRECISION NOT NULL DEFAULT 40,
      -- ignored when grid_type = 'square'
      hex_orientation TEXT NOT NULL DEFAULT 'flat',
      revealed_tiles  JSONB NOT NULL DEFAULT '[]',
      dm_notes        JSONB NOT NULL DEFAULT '[]',
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      BIGINT NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`ALTER TABLE maps ALTER COLUMN offset_x TYPE DOUBLE PRECISION`).catch(() => {});
  await pool.query(`ALTER TABLE maps ALTER COLUMN offset_y TYPE DOUBLE PRECISION`).catch(() => {});
  await pool.query(`ALTER TABLE maps ALTER COLUMN tile_px TYPE DOUBLE PRECISION`).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS maps_session_id_idx
    ON maps (session_id, sort_order)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id             SERIAL PRIMARY KEY,
      title          TEXT        NOT NULL,
      price          INTEGER     NOT NULL,
      description    TEXT,
      stat_type      TEXT        CHECK (stat_type IN ('heal', 'magic', 'attack', 'damage')),
      stat_value     INTEGER,
      image_path     TEXT,
      in_marketplace BOOLEAN     NOT NULL DEFAULT false,
      created_at     TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE items
    ADD COLUMN IF NOT EXISTS in_marketplace BOOLEAN NOT NULL DEFAULT false
  `);

  // Migrate stat_type constraint to include 'damage'
  await pool.query(`
    ALTER TABLE items DROP CONSTRAINT IF EXISTS items_stat_type_check
  `);
  await pool.query(`
    ALTER TABLE items ADD CONSTRAINT items_stat_type_check
    CHECK (stat_type IN ('heal', 'magic', 'attack', 'damage'))
  `);

  // Switch from boolean in_marketplace to integer marketplace_qty
  await pool.query(`
    ALTER TABLE items
    ADD COLUMN IF NOT EXISTS marketplace_qty INTEGER NOT NULL DEFAULT 0
  `);
  // Migrate existing in_marketplace = true rows to qty = 1 (only if still 0)
  await pool.query(`
    UPDATE items SET marketplace_qty = 1
    WHERE in_marketplace = true AND marketplace_qty = 0
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS npcs (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL DEFAULT '',
      species    TEXT NOT NULL DEFAULT '',
      cr         TEXT NOT NULL DEFAULT '',
      hp         TEXT NOT NULL DEFAULT '',
      ac         TEXT NOT NULL DEFAULT '',
      speed      TEXT NOT NULL DEFAULT '',
      attacks    TEXT NOT NULL DEFAULT '',
      traits     TEXT NOT NULL DEFAULT '',
      actions    TEXT NOT NULL DEFAULT '',
      notes      TEXT NOT NULL DEFAULT '',
      image_path TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE npcs ADD COLUMN IF NOT EXISTS image_path TEXT
  `);
  await pool.query(`
    ALTER TABLE npcs ADD COLUMN IF NOT EXISTS hp_roll TEXT NOT NULL DEFAULT ''
  `);

  // Add npc_ids JSONB column to sessions for explicit NPC selection
  await pool.query(`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS npc_ids JSONB NOT NULL DEFAULT '[]'
  `);

  // Menagerie — per-session NPC instances with individual HP
  await pool.query(`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS menagerie JSONB NOT NULL DEFAULT '[]'
  `);

  // DM-only player fields
  await pool.query(`ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS dm_notes TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);

  // Purchased marketplace items — separate from spells for future transfer
  await pool.query(`
    ALTER TABLE player_sheets
    ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'
  `);

  // Gold — currency for marketplace purchases
  await pool.query(`ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS gold TEXT NOT NULL DEFAULT '0'`);
  // Seed gold: level 3 players (levi, brandon) → 100, others → 50
  await pool.query(`
    UPDATE player_sheets SET gold = CASE
      WHEN id IN ('levi', 'brandon') THEN '100'
      ELSE '50'
    END
    WHERE gold = '0'
  `);

  // Repair any rows where npc_ids is not an array (e.g. {} from a bad default)
  await pool.query(`
    UPDATE sessions SET npc_ids = '[]'::jsonb
    WHERE jsonb_typeof(npc_ids) IS DISTINCT FROM 'array'
  `);

  // Ensure the column default is correct regardless of how it was first created
  await pool.query(`
    ALTER TABLE sessions ALTER COLUMN npc_ids SET DEFAULT '[]'::jsonb
  `);

  // Players table — dynamic player roster (seeded from static config)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id          TEXT PRIMARY KEY,
      player_name TEXT NOT NULL DEFAULT '',
      character   TEXT NOT NULL DEFAULT '',
      initial     TEXT NOT NULL DEFAULT '',
      img         TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0
    )
  `);
  // Seed from static PLAYERS if table is empty
  const [{ count }] = await pool.query('SELECT COUNT(*)::int as count FROM players').then(r => r.rows);
  if (count === 0) {
    for (let i = 0; i < PLAYERS.length; i++) {
      const p = PLAYERS[i];
      await pool.query(
        `INSERT INTO players (id, player_name, character, initial, img, sort_order) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.playerName, p.character, p.initial, p.img, i]
      );
    }
  }

  // Backfill img for players with empty img — auto-link to /images/players/{id}.png
  await pool.query(
    `UPDATE players SET img = '/images/players/' || id || '.png' WHERE img = '' OR img IS NULL`
  );

  // Backfill image_path for existing NPCs that match a known image file.
  // Idempotent — only updates rows with empty image_path.
  // Uses the same lookupNpcImage() with partial matching so "Flameskull_2" → flameskull.png.
  const npcsToFill = await pool.query(
    `SELECT id, name FROM npcs WHERE image_path IS NULL OR image_path = ''`
  );
  for (const row of npcsToFill.rows) {
    const match = lookupNpcImage(row.name as string);
    if (match) {
      await pool.query(`UPDATE npcs SET image_path = $1 WHERE id = $2`, [match, row.id]);
    }
  }
}
