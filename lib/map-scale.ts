/**
 * Site-wide canonical map scale.
 *
 * Every map (builder editor, session map view) renders so that one foot of
 * real-world space equals exactly PX_PER_FT screen pixels. The canonical
 * combat cell of 5 ft therefore renders at 60 screen px regardless of how
 * the source image was sized when uploaded. This is what makes maps from
 * different sources look proportional next to each other.
 */

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
