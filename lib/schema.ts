// Run this once to create database tables.
// Called automatically on first API request if tables don't exist.
import { pool } from './db';

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

  // Add npc_ids JSONB column to sessions for explicit NPC selection
  await pool.query(`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS npc_ids JSONB NOT NULL DEFAULT '[]'
  `);
}
