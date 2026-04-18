// World map domain helpers.
//
// This module is the only place in the codebase that writes to world_map,
// world_hexes, and world_entities. API routes call into these helpers; nothing
// else touches the DDL for these tables directly.
//
// Hex coordinates: stored as (q, r) integer pairs in the DB. These are
// treated as even-q offset coordinates matching lib/hex-math.ts (flat-top),
// so q == col and r == row at the display layer. The q/r naming is
// intentional so we can migrate to true axial later without a column rename
// if we ever want cube/axial math in storage.

import { query } from './db';
import { H3_RES } from './h3';
import { qrToH3BigInt } from './world-hex-mapping';

export type RevealState = 'unrevealed' | 'revealed' | 'mapped';

export type WorldEntityKind =
  | 'storm'
  | 'horde'
  | 'caravan'
  | 'army'
  | 'other_party';

export interface WorldMap {
  id: 'default';
  name: string;
  default_north_deg: number;
  created_at: number;
}

export interface WorldHex {
  q: number;
  r: number;
  reveal_state: RevealState;
  terrain_note: string;
  terrain_type: string | null;
  terrain_rotation: number;
  local_map_id: string | null;
  weather_override: string | null;
  updated_at: number;
}

export interface WorldEntity {
  id: string;
  kind: WorldEntityKind;
  label: string;
  current_q: number;
  current_r: number;
  waypoints: Array<{ q: number; r: number }>;
  waypoint_index: number;
  seconds_per_step: number;
  created_at: number;
  updated_at: number;
}

// ── Singleton ──────────────────────────────────────────────────────────────

export async function getWorldMap(): Promise<WorldMap> {
  const rows = await query<WorldMap>(
    `SELECT id, name, default_north_deg, created_at FROM world_map WHERE id = 'default'`
  );
  if (rows.length === 0) {
    // ensureSchema seeds this row, but belt-and-suspenders for edge cases
    // where a caller hits this helper before schema init has finished.
    throw new Error('world_map singleton missing — did ensureSchema run?');
  }
  return rows[0];
}

// ── Hex reads ──────────────────────────────────────────────────────────────

export async function getHex(q: number, r: number): Promise<WorldHex | null> {
  const rows = await query<WorldHex>(
    `SELECT q, r, reveal_state, terrain_note, terrain_type, terrain_rotation, local_map_id, weather_override, updated_at
     FROM world_hexes WHERE q = $1 AND r = $2`,
    [q, r]
  );
  return rows[0] ?? null;
}

export async function listHexes(): Promise<WorldHex[]> {
  return query<WorldHex>(
    `SELECT q, r, reveal_state, terrain_note, terrain_type, terrain_rotation, local_map_id, weather_override, updated_at
     FROM world_hexes`
  );
}

export async function listHexesInRect(
  qMin: number,
  qMax: number,
  rMin: number,
  rMax: number
): Promise<WorldHex[]> {
  return query<WorldHex>(
    `SELECT q, r, reveal_state, terrain_note, terrain_type, terrain_rotation, local_map_id, weather_override, updated_at
     FROM world_hexes
     WHERE q BETWEEN $1 AND $2 AND r BETWEEN $3 AND $4`,
    [qMin, qMax, rMin, rMax]
  );
}

// ── Hex writes ─────────────────────────────────────────────────────────────

export async function setHexReveal(
  q: number,
  r: number,
  state: Exclude<RevealState, 'mapped'>
): Promise<WorldHex> {
  // 'mapped' is set only by setHexLocalMap — do not allow the reveal toggle
  // to accidentally stomp a mapped anchor.
  // H3 dual-write (v3 item #50): h3_cell is deterministic from (q,r) so we
  // populate on INSERT and leave untouched on UPDATE.
  const rows = await query<WorldHex>(
    `INSERT INTO world_hexes (q, r, reveal_state, h3_cell, h3_res, updated_at)
     VALUES ($1, $2, $3, $4, $5, EXTRACT(EPOCH FROM now())::bigint)
     ON CONFLICT (q, r) DO UPDATE
       SET reveal_state = CASE
             WHEN world_hexes.reveal_state = 'mapped' THEN world_hexes.reveal_state
             ELSE EXCLUDED.reveal_state
           END,
           updated_at = EXCLUDED.updated_at
     RETURNING q, r, reveal_state, terrain_note, terrain_type, terrain_rotation, local_map_id, weather_override, updated_at`,
    [q, r, state, qrToH3BigInt(q, r).toString(), H3_RES.DM_HEX]
  );
  return rows[0];
}

export async function setHexTerrainNote(
  q: number,
  r: number,
  note: string
): Promise<WorldHex> {
  const rows = await query<WorldHex>(
    `INSERT INTO world_hexes (q, r, terrain_note, reveal_state, h3_cell, h3_res, updated_at)
     VALUES ($1, $2, $3, 'revealed', $4, $5, EXTRACT(EPOCH FROM now())::bigint)
     ON CONFLICT (q, r) DO UPDATE
       SET terrain_note = EXCLUDED.terrain_note,
           updated_at   = EXCLUDED.updated_at
     RETURNING q, r, reveal_state, terrain_note, terrain_type, terrain_rotation, local_map_id, weather_override, updated_at`,
    [q, r, note, qrToH3BigInt(q, r).toString(), H3_RES.DM_HEX]
  );
  return rows[0];
}

export async function setHexTerrain(
  q: number,
  r: number,
  terrainType: string | null,
  rotation: number
): Promise<WorldHex> {
  const rows = await query<WorldHex>(
    `INSERT INTO world_hexes (q, r, terrain_type, terrain_rotation, reveal_state, h3_cell, h3_res, updated_at)
     VALUES ($1, $2, $3, $4, 'revealed', $5, $6, EXTRACT(EPOCH FROM now())::bigint)
     ON CONFLICT (q, r) DO UPDATE
       SET terrain_type     = EXCLUDED.terrain_type,
           terrain_rotation = EXCLUDED.terrain_rotation,
           reveal_state     = CASE
             WHEN world_hexes.reveal_state = 'unrevealed' THEN 'revealed'
             ELSE world_hexes.reveal_state
           END,
           updated_at       = EXCLUDED.updated_at
     RETURNING q, r, reveal_state, terrain_note, terrain_type, terrain_rotation, local_map_id, weather_override, updated_at`,
    [q, r, terrainType, rotation, qrToH3BigInt(q, r).toString(), H3_RES.DM_HEX]
  );
  return rows[0];
}

// Atomic assignment of a local map to a hex. Clears the previous hex (if any)
// that was pointing at the same local map. Upserts the target hex with
// reveal_state='mapped' and local_map_id set.
export async function setHexLocalMap(
  q: number,
  r: number,
  localMapId: string
): Promise<WorldHex> {
  // Clear any hex currently claiming this local map
  await query(
    `UPDATE world_hexes
     SET local_map_id = NULL,
         reveal_state = CASE WHEN reveal_state = 'mapped' THEN 'revealed' ELSE reveal_state END,
         updated_at   = EXTRACT(EPOCH FROM now())::bigint
     WHERE local_map_id = $1 AND NOT (q = $2 AND r = $3)`,
    [localMapId, q, r]
  );

  const rows = await query<WorldHex>(
    `INSERT INTO world_hexes (q, r, reveal_state, local_map_id, h3_cell, h3_res, updated_at)
     VALUES ($1, $2, 'mapped', $3, $4, $5, EXTRACT(EPOCH FROM now())::bigint)
     ON CONFLICT (q, r) DO UPDATE
       SET reveal_state = 'mapped',
           local_map_id = EXCLUDED.local_map_id,
           updated_at   = EXCLUDED.updated_at
     RETURNING q, r, reveal_state, terrain_note, terrain_type, terrain_rotation, local_map_id, weather_override, updated_at`,
    [q, r, localMapId, qrToH3BigInt(q, r).toString(), H3_RES.DM_HEX]
  );
  return rows[0];
}

export async function clearHexLocalMap(q: number, r: number): Promise<WorldHex | null> {
  const rows = await query<WorldHex>(
    `UPDATE world_hexes
     SET local_map_id = NULL,
         reveal_state = CASE WHEN reveal_state = 'mapped' THEN 'revealed' ELSE reveal_state END,
         updated_at   = EXTRACT(EPOCH FROM now())::bigint
     WHERE q = $1 AND r = $2
     RETURNING q, r, reveal_state, terrain_note, terrain_type, terrain_rotation, local_map_id, weather_override, updated_at`,
    [q, r]
  );
  return rows[0] ?? null;
}

// ── Entities ───────────────────────────────────────────────────────────────

export async function listEntities(): Promise<WorldEntity[]> {
  return query<WorldEntity>(
    `SELECT id, kind, label, current_q, current_r, waypoints, waypoint_index,
            seconds_per_step, created_at, updated_at
     FROM world_entities
     ORDER BY created_at ASC`
  );
}

export async function listEntitiesAtHex(
  q: number,
  r: number
): Promise<WorldEntity[]> {
  return query<WorldEntity>(
    `SELECT id, kind, label, current_q, current_r, waypoints, waypoint_index,
            seconds_per_step, created_at, updated_at
     FROM world_entities
     WHERE current_q = $1 AND current_r = $2`,
    [q, r]
  );
}

export interface CreateEntityInput {
  kind: WorldEntityKind;
  label?: string;
  q: number;
  r: number;
  waypoints?: Array<{ q: number; r: number }>;
  secondsPerStep?: number;
}

export async function createEntity(input: CreateEntityInput): Promise<WorldEntity> {
  // H3 dual-write (v3 item #50): entity position also carries an H3 cell.
  const rows = await query<WorldEntity>(
    `INSERT INTO world_entities
       (id, kind, label, current_q, current_r, h3_cell, h3_res, waypoints, seconds_per_step)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     RETURNING id, kind, label, current_q, current_r, waypoints, waypoint_index,
               seconds_per_step, created_at, updated_at`,
    [
      input.kind,
      input.label ?? '',
      input.q,
      input.r,
      qrToH3BigInt(input.q, input.r).toString(),
      H3_RES.DM_HEX,
      JSON.stringify(input.waypoints ?? []),
      input.secondsPerStep ?? 21600,
    ]
  );
  return rows[0];
}

export async function deleteEntity(id: string): Promise<void> {
  await query(`DELETE FROM world_entities WHERE id = $1`, [id]);
}
