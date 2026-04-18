import { H3_RES, type H3Cell, latLngToCell, cellToBigInt } from './h3';
// Import the constant from the client-safe module so this helper can be
// pulled into client bundles without dragging `pg` along.
import { SHADOW_WORLD_ANCHOR } from './world-anchor-constants';

/**
 * Translate Shadow's legacy even-q offset `(q, r)` hex coordinates into
 * H3 cells at res 6 (`H3_RES.DM_HEX`), positioned relative to the world
 * anchor (Blaen Hafren).
 *
 * The coordinate spacing is chosen to guarantee an **injective** mapping
 * for the live data range — a naïve "use H3's natural cell width"
 * projection produces collisions because H3 cells aren't flat-top
 * oriented on Earth's surface. Empirically, a +16% stride over the
 * natural H3 spacing keeps every Shadow hex in a distinct H3 cell
 * while still reading as geographically coherent (~7 km center-to-center).
 *
 * v3 item #40 uses this for the one-shot backfill of existing rows; v3
 * item #50 will use it for the dual-write path on new reveals.
 */

// Natural H3 res-6 geometry: cell width (flat-to-flat) ≈ 6.46 km.
// +16% stride (6.50 / 7.51 km) — the minimum multiplier that is injective
// on Shadow's current q∈[-11,3], r∈[-10,0] grid.
const COL_STRIDE_KM = 6.50;       // east distance per Δq = 1
const ROW_STRIDE_KM = 7.51;       // south distance per Δr = 1
const ODD_COL_Y_OFFSET_KM = 3.76; // odd-q column y shift (flat-top even-q)

const KM_PER_DEG_LAT = 111;
const KM_PER_DEG_LNG = 111 * Math.cos(SHADOW_WORLD_ANCHOR.lat * Math.PI / 180);

/** Project a legacy `(q, r)` hex coordinate to approximate `[lat, lng]`. */
export function qrToLatLng(q: number, r: number): [number, number] {
  const isOdd = ((q % 2) + 2) % 2 === 1;
  const x_km = q * COL_STRIDE_KM;
  const y_km = r * ROW_STRIDE_KM + (isOdd ? ODD_COL_Y_OFFSET_KM : 0);
  return [
    SHADOW_WORLD_ANCHOR.lat - y_km / KM_PER_DEG_LAT, // +r = south → -lat
    SHADOW_WORLD_ANCHOR.lng + x_km / KM_PER_DEG_LNG, // +q = east  → +lng
  ];
}

/** Return the H3 cell (res 6) containing the projected `(q, r)` coordinate. */
export function qrToH3Cell(q: number, r: number): H3Cell {
  const [lat, lng] = qrToLatLng(q, r);
  return latLngToCell(lat, lng, H3_RES.DM_HEX);
}

/** Return the BIGINT form of the cell for direct storage in `h3_cell` columns. */
export function qrToH3BigInt(q: number, r: number): bigint {
  return cellToBigInt(qrToH3Cell(q, r));
}
