/**
 * Site-wide canonical map scale.
 *
 * Every map (builder editor, session map view) renders so that one foot of
 * real-world space equals exactly PX_PER_FT screen pixels. The canonical
 * combat cell of 5 ft therefore renders at 60 screen px regardless of how
 * the source image was sized when uploaded. This is what makes maps from
 * different sources look proportional next to each other.
 */

import { cellAreaKm2, bigIntToCell, type H3Cell } from './h3';

export const PX_PER_FT = 12;

/** Screen pixels for one cell at the given real-world scale (in feet). */
export function cellScreenPx(scaleValueFt: number): number {
  return scaleValueFt * PX_PER_FT;
}

/**
 * Compute the on-screen display size of a map image so its grid lines up
 * with the canonical scale.
 *
 * - imageNaturalWidth/Height: pixels of the source image at full resolution.
 * - cellSizePx: pixels per grid cell as measured on the source image
 *   (the value Mappy returns or the DM enters via calibration).
 * - scaleValueFt: real-world feet per cell (5 for combat, etc.).
 *
 * Returns the width/height in screen pixels at which to render the image.
 * Falls back to natural size if any input is missing.
 */
export function imageDisplaySize(opts: {
  imageNaturalWidth: number;
  imageNaturalHeight: number;
  cellSizePx: number | null | undefined;
  scaleValueFt: number | null | undefined;
}): { width: number; height: number } {
  const { imageNaturalWidth, imageNaturalHeight, cellSizePx, scaleValueFt } = opts;
  if (!cellSizePx || !scaleValueFt || cellSizePx <= 0 || scaleValueFt <= 0) {
    return { width: imageNaturalWidth, height: imageNaturalHeight };
  }
  const ratio = cellScreenPx(scaleValueFt) / cellSizePx;
  return {
    width: imageNaturalWidth * ratio,
    height: imageNaturalHeight * ratio,
  };
}

/**
 * Default real-world feet per cell for a given grid + scale-mode combo.
 * Returns null when both inputs are unknown.
 */
export function defaultScaleValueFt(opts: {
  gridType: 'square' | 'hex' | 'none' | null | undefined;
  scaleMode: 'combat' | 'overland' | 'none' | null | undefined;
}): number | null {
  const { gridType, scaleMode } = opts;
  if (scaleMode === 'overland') {
    // 6 miles per hex (D&D wilderness travel standard)
    if (gridType === 'hex') return 6 * 5280;
    // 1 mile per square (rare, but supported)
    if (gridType === 'square') return 5280;
  }
  if (scaleMode === 'combat') {
    // 5 ft per cell (D&D tactical standard, square or hex)
    return 5;
  }
  return null;
}

// ─── v3 item #60 — Mappy H3 anchor fit check ────────────────────────────────

const FT_PER_KM = 3280.84;

export type AnchorFitSeverity = 'ok' | 'warn' | 'error';

export interface AnchorFitCheck {
  /** Max (width, height) of the local map in km, using its declared scale. */
  mapExtentKm: { width: number; height: number };
  /** H3 anchor cell's flat-to-flat diameter in km (res-6 ≈ 6.5 km). */
  cellFlatToFlatKm: number;
  /** map longest-side / cell flat-to-flat. 1 = fits exactly; <1 = smaller than cell. */
  ratio: number;
  severity: AnchorFitSeverity;
  /** Human-readable explanation (one sentence). */
  message: string;
}

/**
 * Compare a local map's real-world extent to the H3 anchor cell it's
 * pinned to. Warns when the map is meaningfully larger than the cell —
 * either the DM picked the wrong scale in Mappy, the wrong anchor hex,
 * or the image was cropped/scaled oddly.
 *
 * `ok`    ≤ 1.5× the cell (map fits with expected slack)
 * `warn`  1.5× – 3× (bigger than the cell, probably a cluster or mis-scale)
 * `error` > 3× (clearly wrong — different scale mode or different anchor)
 *
 * Returns null when inputs are incomplete (no cell size, no scale, no
 * image dimensions); the caller should just skip the check silently
 * rather than render a noisy warning.
 */
export function h3AnchorFitCheck(opts: {
  imageNaturalWidth: number;
  imageNaturalHeight: number;
  cellSizePx: number | null | undefined;
  scaleValueFt: number | null | undefined;
  /** Area of the anchor H3 cell in km² — from h3-js `cellArea(cell, 'km2')`. */
  anchorCellAreaKm2: number;
}): AnchorFitCheck | null {
  const { imageNaturalWidth, imageNaturalHeight, cellSizePx, scaleValueFt, anchorCellAreaKm2 } = opts;
  if (!cellSizePx || !scaleValueFt || cellSizePx <= 0 || scaleValueFt <= 0) return null;
  if (!imageNaturalWidth || !imageNaturalHeight) return null;
  if (!anchorCellAreaKm2 || anchorCellAreaKm2 <= 0) return null;

  const widthKm = (imageNaturalWidth / cellSizePx) * scaleValueFt / FT_PER_KM;
  const heightKm = (imageNaturalHeight / cellSizePx) * scaleValueFt / FT_PER_KM;

  // Regular hexagon: area = 3√3/2 · R² where R = center-to-corner.
  // Flat-to-flat diameter = R · √3.
  const R = Math.sqrt((2 * anchorCellAreaKm2) / (3 * Math.sqrt(3)));
  const cellFlatToFlatKm = R * Math.sqrt(3);

  const longest = Math.max(widthKm, heightKm);
  const ratio = longest / cellFlatToFlatKm;

  let severity: AnchorFitSeverity;
  let message: string;
  if (ratio <= 1.5) {
    severity = 'ok';
    message = `Map (~${longest.toFixed(1)} km) fits within the anchor cell (~${cellFlatToFlatKm.toFixed(1)} km across).`;
  } else if (ratio <= 3) {
    severity = 'warn';
    message = `Map (~${longest.toFixed(1)} km) is ${ratio.toFixed(1)}× the anchor cell (~${cellFlatToFlatKm.toFixed(1)} km). Scale or anchor may be off.`;
  } else {
    severity = 'error';
    message = `Map (~${longest.toFixed(1)} km) is ${ratio.toFixed(1)}× the anchor cell (~${cellFlatToFlatKm.toFixed(1)} km). Likely wrong scale mode or wrong anchor hex.`;
  }

  return {
    mapExtentKm: { width: widthKm, height: heightKm },
    cellFlatToFlatKm,
    ratio,
    severity,
    message,
  };
}

/**
 * Convenience wrapper for callers that only have the anchor cell (as a hex
 * string or DB-stored BIGINT). Looks up the cell's real area via h3-js and
 * delegates to `h3AnchorFitCheck`.
 */
export function h3AnchorFitCheckByCell(opts: {
  imageNaturalWidth: number;
  imageNaturalHeight: number;
  cellSizePx: number | null | undefined;
  scaleValueFt: number | null | undefined;
  anchorCell: H3Cell | bigint | string | null | undefined;
}): AnchorFitCheck | null {
  if (opts.anchorCell === null || opts.anchorCell === undefined) return null;
  // H3 cell hex strings are always 15 characters; BIGINT decimal strings
  // from Postgres are 18–20 digits. Use length to disambiguate a
  // digits-only string that could be either form.
  const cell: H3Cell = typeof opts.anchorCell === 'bigint'
    ? bigIntToCell(opts.anchorCell)
    : opts.anchorCell.length === 15 && /^[0-9a-f]+$/i.test(opts.anchorCell)
      ? opts.anchorCell
      : bigIntToCell(BigInt(opts.anchorCell));
  return h3AnchorFitCheck({
    imageNaturalWidth: opts.imageNaturalWidth,
    imageNaturalHeight: opts.imageNaturalHeight,
    cellSizePx: opts.cellSizePx,
    scaleValueFt: opts.scaleValueFt,
    anchorCellAreaKm2: cellAreaKm2(cell),
  });
}
