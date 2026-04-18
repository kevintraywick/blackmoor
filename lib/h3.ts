import {
  cellArea,
  cellToChildren as h3CellToChildren,
  cellToLatLng as h3CellToLatLng,
  cellToParent as h3CellToParent,
  getPentagons,
  getResolution as h3GetResolution,
  gridDisk,
  isPentagon as h3IsPentagon,
  isValidCell as h3IsValidCell,
  latLngToCell as h3LatLngToCell,
} from 'h3-js';

/**
 * Single canonical wrapper around h3-js for Blackmoor's Common World.
 *
 * H3 is Uber's open-source hexagonal grid. It divides the globe into hexagons
 * (plus 12 pentagons where the icosahedral projection leaves gaps). Sixteen
 * resolutions (0–15) nest aperture-7: one res-5 cell contains exactly 7 res-6
 * cells, recursively.
 *
 * We use cell IDs as the primary spatial key on every world-scoped table.
 * Cells round-trip cleanly between h3-js's 15-char hex string form and a
 * Postgres BIGINT (confirmed safe — every cell at every resolution has its
 * top bit clear and fits in signed 64-bit).
 *
 * See BRAINSTORM.md §7 for rationale, §10 for pentagons-as-astral-voids.
 */

/** An H3 cell index in hex-string form (e.g. "87264e04effffff"). */
export type H3Cell = string;

/**
 * Canonical resolutions used across the Common World.
 * Class III resolutions (odd numbers) are rotated relative to the icosahedron
 * and add minor distortion — prefer even resolutions at tenancy boundaries.
 */
export const H3_RES = {
  /** Continental — World AI operates here (≈4.25M km² / cell). */
  CONTINENT: 2,
  /** Nation — Chronicler-tier claims (≈607K km² / cell). */
  NATION: 3,
  /** Region — Cartographer-tier claims (≈86K km² / cell). */
  REGION: 4,
  /** Province — mid-scale campaigns (≈12K km² / cell). */
  PROVINCE: 5,
  /** Classic D&D 6-mile hex (~36 km² / cell). Hexcrawl default. */
  DM_HEX: 6,
  /** Newbie-DM claim size (≈5 km² / cell). */
  CLAIM: 7,
  /** Neighborhood / large settlement (≈0.7 km² / cell). */
  SETTLEMENT: 8,
  /** Building-scale (~15m edge length). */
  BUILDING: 10,
} as const;

export type H3ResKey = keyof typeof H3_RES;
export type H3Resolution = (typeof H3_RES)[H3ResKey];

// ─── Cell creation / inspection ────────────────────────────────────────────

/** Find the H3 cell that contains a given lat/lng at a given resolution. */
export function latLngToCell(lat: number, lng: number, resolution: number): H3Cell {
  return h3LatLngToCell(lat, lng, resolution);
}

/** Return the center [lat, lng] of a cell. */
export function cellToLatLng(cell: H3Cell): [number, number] {
  return h3CellToLatLng(cell);
}

/** Return the resolution (0-15) of a cell. */
export function cellResolution(cell: H3Cell): number {
  return h3GetResolution(cell);
}

/** Return the area of a cell in km². */
export function cellAreaKm2(cell: H3Cell): number {
  return cellArea(cell, 'km2');
}

/** Return true if the cell is a pentagon (one of the 12 per resolution). */
export function isPentagon(cell: H3Cell): boolean {
  return h3IsPentagon(cell);
}

/** Return true if the string is a syntactically valid H3 cell index. */
export function isValidCell(cell: string): boolean {
  return h3IsValidCell(cell);
}

// ─── Neighborhood / hierarchy ──────────────────────────────────────────────

/**
 * Return all cells within k grid steps of the origin (including origin).
 * k=1 returns 7 cells (origin + 6 neighbors) for hexagons, 6 for pentagons.
 * Known as "k-ring" in H3 v3; "gridDisk" in v4.
 */
export function kRing(cell: H3Cell, k: number): H3Cell[] {
  return gridDisk(cell, k);
}

/** Return the parent cell at a coarser resolution. */
export function cellToParent(cell: H3Cell, parentResolution: number): H3Cell {
  return h3CellToParent(cell, parentResolution);
}

/**
 * Return the 7 child cells at a finer resolution (6 for pentagons).
 * Recursive — child_res must be greater than the cell's current resolution.
 */
export function cellToChildren(cell: H3Cell, childResolution: number): H3Cell[] {
  return h3CellToChildren(cell, childResolution);
}

// ─── Pentagon / astral-void helpers ────────────────────────────────────────

/**
 * Return all 12 pentagon cells at a given resolution.
 * These pin the astral voids of the Common World cosmology (see §10 of
 * BRAINSTORM.md). The set is deterministic per resolution.
 */
export function allPentagons(resolution: number): H3Cell[] {
  return getPentagons(resolution);
}

// ─── DB conversion (BIGINT in Postgres) ────────────────────────────────────

/**
 * Convert an H3 cell string to a BigInt for BIGINT column storage.
 *
 * Every H3 cell at every resolution fits in signed 64-bit (top bit is always
 * clear). Round-trips exactly: `bigIntToCell(cellToBigInt(c)) === c`.
 */
export function cellToBigInt(cell: H3Cell): bigint {
  return BigInt('0x' + cell);
}

/** Convert a BIGINT-stored cell back to its hex-string form. */
export function bigIntToCell(n: bigint): H3Cell {
  return n.toString(16);
}

/**
 * Parse a value read from a BIGINT column (which node-pg returns as string
 * by default) back into an H3 cell string. Accepts either string, number,
 * or bigint shapes for flexibility.
 */
export function parseDbCell(value: string | number | bigint): H3Cell {
  if (typeof value === 'bigint') return bigIntToCell(value);
  if (typeof value === 'number') return bigIntToCell(BigInt(value));
  return bigIntToCell(BigInt(value));
}
