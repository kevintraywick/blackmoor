/**
 * Camera-distance → kilometers-per-screen-pixel for the 3D globe.
 *
 * The globe is rendered on a unit sphere (radius = 1 world unit = 6371 km).
 * For a perspective camera at distance D from origin (D > 1), the closest
 * surface point sits at distance (D − 1). At that distance the visible
 * vertical world-units span is 2·(D − 1)·tan(fov/2), so the per-pixel
 * world-unit size is that span ÷ viewport height — multiply by 6371 to
 * get km/px.
 *
 * Used by the persistent ScaleBar HUD on Globe3DClient so the bar reflects
 * the *actual* on-screen scale at the front of the planet, not a globe-wide
 * average.
 */

const KM_PER_WORLD_UNIT = 6371;

export function kmPerScreenPxAtSurface(opts: {
  cameraDistance: number;
  fovDeg: number;
  viewportHeightPx: number;
}): number {
  const { cameraDistance, fovDeg, viewportHeightPx } = opts;
  if (cameraDistance <= 1 || viewportHeightPx <= 0) return 0;
  const halfFovRad = (fovDeg * Math.PI) / 180 / 2;
  const worldUnitsTall = 2 * (cameraDistance - 1) * Math.tan(halfFovRad);
  const worldUnitsPerPx = worldUnitsTall / viewportHeightPx;
  return worldUnitsPerPx * KM_PER_WORLD_UNIT;
}

/**
 * Pick a "round" length (in km) that fits within `targetWidthPx` on screen
 * given the current km/px. Returns the length in km plus its rendered width.
 *
 * Uses 1-2-5 progression (..., 1, 2, 5, 10, 20, 50, 100, ...) so the bar
 * always reads as a friendly round number.
 */
export function pickRoundKmForBar(opts: {
  kmPerPx: number;
  targetWidthPx: number;
}): { km: number; widthPx: number } {
  const { kmPerPx, targetWidthPx } = opts;
  if (kmPerPx <= 0 || targetWidthPx <= 0) return { km: 0, widthPx: 0 };
  const targetKm = targetWidthPx * kmPerPx;
  const exponent = Math.floor(Math.log10(targetKm));
  const base = Math.pow(10, exponent);
  const mantissa = targetKm / base;
  const choices = [1, 2, 5, 10];
  let chosen = choices[0];
  for (const c of choices) {
    if (c <= mantissa) chosen = c;
  }
  const km = chosen * base;
  return { km, widthPx: km / kmPerPx };
}

const KM_PER_MI = 1.609344;

export function kmToMi(km: number): number {
  return km / KM_PER_MI;
}
