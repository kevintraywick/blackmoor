/**
 * Shared hex grid math for flat-top hexagons using even-q offset coordinates.
 * Used by both MapCanvas (session maps) and BuilderCanvas (map builder).
 *
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */

/** Compute the pixel center of a flat-top hex in world space.
 *  NOTE: Works for negative `col`. JavaScript's `%` returns a negative result
 *  for negative operands (e.g. -1 % 2 === -1), so a naive `col % 2 === 1`
 *  check misclassifies negative odd columns. Use a sign-safe odd test. */
export function hexCenter(col: number, row: number, hexSize: number): { cx: number; cy: number } {
  const w = hexSize * 2;
  const h = hexSize * Math.sqrt(3);
  const isOdd = ((col % 2) + 2) % 2 === 1;
  return {
    cx: col * w * 0.75 + hexSize,
    cy: row * h + h / 2 + (isOdd ? h / 2 : 0),
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
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(s);
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

/**
 * Get the 6 neighbors of a flat-top hex in even-q offset coordinates.
 * CRITICAL: Returns neighbors in edge order (0-5) matching hexPath corner angles.
 * Edge i connects corner at angle (60*i)° to corner at angle (60*(i+1))°.
 *
 * For flat-top hex:
 *   Edge 0 (0°→60°)   = upper-right  → NE neighbor
 *   Edge 1 (60°→120°)  = top          → N neighbor
 *   Edge 2 (120°→180°) = upper-left   → NW neighbor
 *   Edge 3 (180°→240°) = lower-left   → SW neighbor
 *   Edge 4 (240°→300°) = bottom       → S neighbor
 *   Edge 5 (300°→360°) = lower-right  → SE neighbor
 */
export function hexNeighbors(col: number, row: number): [number, number][] {
  // Sign-safe odd test — see hexCenter for why a naive `col % 2 === 1` is wrong
  // for negative columns.
  const isOdd = ((col % 2) + 2) % 2 === 1;
  if (isOdd) {
    return [
      [col + 1, row],     // Edge 0: NE
      [col, row - 1],     // Edge 1: N
      [col - 1, row],     // Edge 2: NW
      [col - 1, row + 1], // Edge 3: SW
      [col, row + 1],     // Edge 4: S
      [col + 1, row + 1], // Edge 5: SE
    ];
  } else {
    return [
      [col + 1, row - 1], // Edge 0: NE
      [col, row - 1],     // Edge 1: N
      [col - 1, row - 1], // Edge 2: NW
      [col - 1, row],     // Edge 3: SW
      [col, row + 1],     // Edge 4: S
      [col + 1, row],     // Edge 5: SE
    ];
  }
}

/**
 * Get the two corner points of hex edge i (0-5) for a flat-top hex.
 * Edge i connects corner i and corner (i+1)%6.
 */
export function hexEdgePoints(cx: number, cy: number, R: number, edgeIndex: number): { x1: number; y1: number; x2: number; y2: number } {
  const a1 = (Math.PI / 180) * (60 * edgeIndex);
  const a2 = (Math.PI / 180) * (60 * ((edgeIndex + 1) % 6));
  return {
    x1: cx + R * Math.cos(a1),
    y1: cy + R * Math.sin(a1),
    x2: cx + R * Math.cos(a2),
    y2: cy + R * Math.sin(a2),
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
