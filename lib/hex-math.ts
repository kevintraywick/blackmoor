/**
 * Shared hex grid math for flat-top hexagons using even-q offset coordinates.
 * Used by both MapCanvas (session maps) and BuilderCanvas (map builder).
 *
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */

/** Compute the pixel center of a flat-top hex in world space. */
export function hexCenter(col: number, row: number, hexSize: number): { cx: number; cy: number } {
  const w = hexSize * 2;
  const h = hexSize * Math.sqrt(3);
  return {
    cx: col * w * 0.75 + hexSize,
    cy: row * h + h / 2 + (col % 2 === 1 ? h / 2 : 0),
  };
}

/** Draw a flat-top hex path onto a CanvasRenderingContext2D. Does not call fill/stroke. */
export function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = cx + R * Math.cos(angle);
    const py = cy + R * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Convert a world-space pixel coordinate to a hex grid [col, row] (even-q offset). */
export function pixelToHex(
  px: number,
  py: number,
  hexSize: number,
  cols: number,
  rows: number,
): [number, number] | null {
  const h = hexSize * Math.sqrt(3);
  const x = px - hexSize;
  const y = py - h / 2;

  // Axial from pixel (flat-top)
  const q = (2 / 3 * x) / hexSize;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / hexSize;
  const s = -q - r;

  // Cube round
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;

  // Axial → offset (even-q)
  const col = rq;
  const row = rr + Math.floor(rq / 2);

  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  return [col, row];
}

/** Compute the world-space bounding box of the full hex grid. */
export function gridBounds(cols: number, rows: number, hexSize: number) {
  const w = hexSize * 2;
  const h = hexSize * Math.sqrt(3);
  return {
    width: cols * w * 0.75 + w * 0.25,
    height: (rows + 0.5) * h,
  };
}

/** Get the hex coordinate range visible within a viewport (for culling). */
export function visibleHexRange(
  viewX: number, viewY: number, viewW: number, viewH: number,
  hexSize: number, cols: number, rows: number,
): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
  const w = hexSize * 2;
  const h = hexSize * Math.sqrt(3);

  const minCol = Math.max(0, Math.floor(viewX / (w * 0.75)) - 1);
  const maxCol = Math.min(cols - 1, Math.ceil((viewX + viewW) / (w * 0.75)) + 1);
  const minRow = Math.max(0, Math.floor(viewY / h) - 1);
  const maxRow = Math.min(rows - 1, Math.ceil((viewY + viewH) / h) + 1);

  return { minCol, maxCol, minRow, maxRow };
}
