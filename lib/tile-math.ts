/**
 * Slippy-map tile math. XYZ tiling per the OGC/OSM convention.
 *
 * Stamen, OSM, and ESRI all use this tile scheme (ESRI flips the URL
 * order to z/y/x but the math is identical).
 */

export interface TileBoundsLatLng {
  n: number;
  s: number;
  e: number;
  w: number;
}

export function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return Math.floor(y * 2 ** z);
}

export function tileBoundsLatLng(z: number, x: number, y: number): TileBoundsLatLng {
  const n2 = 2 ** z;
  const lng_w = (x / n2) * 360 - 180;
  const lng_e = ((x + 1) / n2) * 360 - 180;
  const lat_n = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n2))) * 180) / Math.PI;
  const lat_s = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n2))) * 180) / Math.PI;
  return { n: lat_n, s: lat_s, e: lng_e, w: lng_w };
}
