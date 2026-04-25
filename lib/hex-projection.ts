import { cellToBoundary, cellToLatLng } from 'h3-js';

/**
 * Project an H3 cell's hexagonal boundary onto a local 2D plane (km),
 * centered on the cell's centroid. Each vertex is placed at its
 * (great-circle bearing, great-circle distance) from the centroid —
 * +x = east, +y = north.
 *
 * For res-4 cells this gives a near-regular hexagon ~45 km vertex-to-vertex
 * (~22.6 km edge). The slight irregularity inherent to icosahedral H3 is
 * preserved — cells near the icosahedron's seams will look mildly skewed,
 * which is honest about the underlying geometry.
 */

const EARTH_RADIUS_KM = 6371;
const RAD = Math.PI / 180;

interface HexProjection {
  cell: string;
  centerLat: number;
  centerLng: number;
  /** Boundary vertices in local km, +x = east, +y = north. */
  vertices: Array<{ x: number; y: number }>;
  /** Half-vertex-to-vertex of the *bounding circle* of the projected polygon (km). */
  outerRadiusKm: number;
}

function greatCircleDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * RAD;
  const φ2 = lat2 * RAD;
  const Δφ = (lat2 - lat1) * RAD;
  const Δλ = (lng2 - lng1) * RAD;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function bearingRad(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * RAD;
  const φ2 = lat2 * RAD;
  const Δλ = (lng2 - lng1) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.atan2(y, x); // 0 = N, π/2 = E
}

export function projectHex(cell: string): HexProjection {
  const [centerLat, centerLng] = cellToLatLng(cell);
  const boundary = cellToBoundary(cell); // Array<[lat, lng]>
  let outerRadiusKm = 0;
  const vertices = boundary.map(([lat, lng]) => {
    const dKm = greatCircleDistanceKm(centerLat, centerLng, lat, lng);
    const θ = bearingRad(centerLat, centerLng, lat, lng);
    // Bearing 0 = N → +y, π/2 = E → +x.
    const x = dKm * Math.sin(θ);
    const y = dKm * Math.cos(θ);
    if (dKm > outerRadiusKm) outerRadiusKm = dKm;
    return { x, y };
  });
  return { cell, centerLat, centerLng, vertices, outerRadiusKm };
}

/**
 * Build an SVG path "M x,y L x,y ... Z" from a projected hex's vertices,
 * scaled by `pxPerKm` and centered on (cx, cy) in viewport pixels.
 * Note: SVG +y is *down*, so the projection's +y north is flipped.
 */
export function hexSvgPath(
  projection: HexProjection,
  pxPerKm: number,
  cx: number,
  cy: number,
): string {
  const v = projection.vertices;
  if (v.length === 0) return '';
  const toScreen = (vx: number, vy: number) => `${cx + vx * pxPerKm},${cy - vy * pxPerKm}`;
  let d = `M ${toScreen(v[0].x, v[0].y)}`;
  for (let i = 1; i < v.length; i++) d += ` L ${toScreen(v[i].x, v[i].y)}`;
  d += ' Z';
  return d;
}
