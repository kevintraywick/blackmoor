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
}
