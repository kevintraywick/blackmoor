import { H3_RES, type H3Cell, latLngToCell, cellToBigInt } from './h3';
import { pool } from './db';
import { ensureSchema } from './schema';

/**
 * The Common World's founding anchor — Blaen Hafren, the source of the
 * River Severn on Plynlimon (Pumlumon) in the Cambrian Mountains, Wales.
 *
 * This is the fixed point that ties every Common World hex to an Earth
 * coordinate for the laundering rule in §9 of BRAINSTORM.md. Earth data
 * (elevation, climate, prevailing winds, NOAA weather) is pulled relative
 * to this cell and remapped to the Common World's own grid.
 *
 * The anchor is seeded into `world_map.h3_cell` + `h3_res`; the DB is
 * the authoritative source at runtime. This constant serves as seed,
 * fallback, and documentation.
 *
 * Chosen 2026-04-18. Never moves.
 */
export const SHADOW_WORLD_ANCHOR = {
  /** Plynlimon, source of the Severn — canonical world origin. */
  name: 'Blaen Hafren',
  lat: 52.4833,
  lng: -3.7333,
  resolution: H3_RES.DM_HEX,
} as const;

/** Derived H3 cell string for the anchor (res 6). */
export const SHADOW_ANCHOR_CELL: H3Cell = latLngToCell(
  SHADOW_WORLD_ANCHOR.lat,
  SHADOW_WORLD_ANCHOR.lng,
  SHADOW_WORLD_ANCHOR.resolution,
);

/** Derived BIGINT form for direct `world_map.h3_cell` storage. */
export const SHADOW_ANCHOR_BIGINT: bigint = cellToBigInt(SHADOW_ANCHOR_CELL);

export interface WorldAnchor {
  cell: H3Cell;
  resolution: number;
}

/**
 * Return the world's anchor cell + resolution.
 *
 * Reads `world_map` singleton. Falls back to the compile-time constant
 * if the row is missing or un-seeded — so callers never have to guard
 * against NULL. In practice the row is always seeded; the fallback is
 * belt-and-suspenders.
 */
export async function getWorldAnchor(): Promise<WorldAnchor> {
  await ensureSchema();
  const { rows } = await pool.query<{ h3_cell: string | null; h3_res: number | null }>(
    `SELECT h3_cell::text AS h3_cell, h3_res FROM world_map WHERE id = 'default'`,
  );
  const row = rows[0];
  if (!row || row.h3_cell === null || row.h3_res === null) {
    return { cell: SHADOW_ANCHOR_CELL, resolution: SHADOW_WORLD_ANCHOR.resolution };
  }
  // pg returns BIGINT as string; convert back through hex.
  const cell = BigInt(row.h3_cell).toString(16);
  return { cell, resolution: row.h3_res };
}
