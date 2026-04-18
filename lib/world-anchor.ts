import { type H3Cell } from './h3';
import { pool } from './db';
import { ensureSchema } from './schema';
import { SHADOW_WORLD_ANCHOR, SHADOW_ANCHOR_CELL } from './world-anchor-constants';

/**
 * Server-only DB reader for the world anchor. Client code that just needs the
 * constant should import from `./world-anchor-constants` instead.
 *
 * Anchor = Blaen Hafren, source of the Severn on Plynlimon (Cambrian
 * Mountains, Wales). Chosen 2026-04-18. Never moves.
 */

// Re-export the constants so existing server-side imports keep working.
export { SHADOW_WORLD_ANCHOR, SHADOW_ANCHOR_CELL, SHADOW_ANCHOR_BIGINT } from './world-anchor-constants';

export interface WorldAnchor {
  cell: H3Cell;
  resolution: number;
}

/**
 * Return the world's anchor cell + resolution.
 *
 * Reads `world_map` singleton. Falls back to the compile-time constant
 * if the row is missing or un-seeded — so callers never have to guard
 * against NULL.
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
  const cell = BigInt(row.h3_cell).toString(16);
  return { cell, resolution: row.h3_res };
}
