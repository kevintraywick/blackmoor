/**
 * Reader for the biome-keyed hex substrate (Ambience v1, R1).
 *
 * Every H3 cell touched by the campaign has immutable climate metadata
 * seeded into `ambience_hex_substrate`. This module is the single read
 * path; writes happen only via the seed script.
 *
 * See docs/plans/2026-04-19-001-feat-ambience-v1-plan.md Unit 1.
 */

import { pool } from './db';
import { ensureSchema } from './schema';
import { cellToBigInt, bigIntToCell, type H3Cell } from './h3';
import type { BiomeSubstrate, KoppenZone } from './types';

interface SubstrateRow {
  h3_cell: string; // pg returns bigint as decimal string
  h3_res: number;
  koppen: string;
  elevation_m: number;
  coastal: boolean;
  cw_latitude: number;
}

function rowToSubstrate(row: SubstrateRow): BiomeSubstrate {
  return {
    h3_cell: bigIntToCell(BigInt(row.h3_cell)),
    h3_res: row.h3_res,
    koppen: row.koppen as KoppenZone,
    elevation_m: row.elevation_m,
    coastal: row.coastal,
    cw_latitude: row.cw_latitude,
  };
}

/** Look up substrate for a single H3 cell. Returns null if not yet seeded. */
export async function getSubstrate(cell: H3Cell): Promise<BiomeSubstrate | null> {
  await ensureSchema();
  const bi = cellToBigInt(cell).toString();
  const { rows } = await pool.query<SubstrateRow>(
    `SELECT h3_cell::text AS h3_cell, h3_res, koppen, elevation_m, coastal, cw_latitude
     FROM ambience_hex_substrate WHERE h3_cell = $1`,
    [bi],
  );
  return rows[0] ? rowToSubstrate(rows[0]) : null;
}

/** Bulk lookup for a set of cells. Missing cells are omitted from the result. */
export async function getSubstrateMany(cells: H3Cell[]): Promise<Map<H3Cell, BiomeSubstrate>> {
  await ensureSchema();
  if (cells.length === 0) return new Map();
  const bis = cells.map((c) => cellToBigInt(c).toString());
  const { rows } = await pool.query<SubstrateRow>(
    `SELECT h3_cell::text AS h3_cell, h3_res, koppen, elevation_m, coastal, cw_latitude
     FROM ambience_hex_substrate WHERE h3_cell = ANY($1::bigint[])`,
    [bis],
  );
  const out = new Map<H3Cell, BiomeSubstrate>();
  for (const row of rows) {
    const sub = rowToSubstrate(row);
    out.set(sub.h3_cell, sub);
  }
  return out;
}
