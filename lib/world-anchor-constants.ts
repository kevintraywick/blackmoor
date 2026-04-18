import { H3_RES, type H3Cell, latLngToCell, cellToBigInt } from './h3';

/**
 * Client-safe anchor constants.
 *
 * Split out from `lib/world-anchor.ts` so that client components (and any
 * module in their dep graph) can import the anchor without dragging `pg` /
 * `lib/db` into the browser bundle.
 *
 * The DB reader `getWorldAnchor()` stays in `lib/world-anchor.ts`.
 */

/** Plynlimon, source of the Severn — canonical world origin. Never moves. */
export const SHADOW_WORLD_ANCHOR = {
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
