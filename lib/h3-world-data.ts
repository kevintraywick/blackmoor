import { cellToBoundary, cellToLatLng, cellToParent, cellToChildren, getRes0Cells, gridDisk, isPentagon } from 'h3-js';

/**
 * Shared pre-computation helpers for the /dm/globe and /dm/globe-3d views.
 * Server-only conceptually (no client imports), but pure JS — just kept out
 * of client bundles by convention because the output payload is large.
 */

export interface PreparedCell {
  cell: string;
  resolution: number;
  boundary: Array<[number, number]>; // [lat, lng] vertex pairs
  center: [number, number]; // [lat, lng]
  isPentagon: boolean;
  shadowDescendantCount: number;
  isAnchorAncestor: boolean;
}

function listCellsAtResolution(resolution: number): string[] {
  if (resolution === 0) return getRes0Cells();
  const prev = listCellsAtResolution(resolution - 1);
  const out: string[] = [];
  for (const parent of prev) {
    for (const child of cellToChildren(parent, resolution)) out.push(child);
  }
  return out;
}

/**
 * Prepare a small set of cells by explicit cell IDs — useful when the
 * full-globe prep at a high resolution would be prohibitively large (e.g. res-4
 * globally is 288,122 cells). Callers pass only the cells they care about.
 */
export function prepareCells(
  cells: string[],
  resolution: number,
  shadowRes6Cells: string[],
  anchorCell: string,
): PreparedCell[] {
  const shadowCount = new Map<string, number>();
  for (const c of shadowRes6Cells) {
    const ancestor = cellToParent(c, resolution);
    shadowCount.set(ancestor, (shadowCount.get(ancestor) ?? 0) + 1);
  }
  const anchorAncestor = cellToParent(anchorCell, resolution);

  const out: PreparedCell[] = [];
  for (const cell of cells) {
    const boundary = cellToBoundary(cell).map(
      ([lat, lng]) =>
        [Math.round(lat * 10000) / 10000, Math.round(lng * 10000) / 10000] as [number, number],
    );
    const [cLat, cLng] = cellToLatLng(cell);
    out.push({
      cell,
      resolution,
      boundary,
      center: [Math.round(cLat * 10000) / 10000, Math.round(cLng * 10000) / 10000],
      isPentagon: isPentagon(cell),
      shadowDescendantCount: shadowCount.get(cell) ?? 0,
      isAnchorAncestor: cell === anchorAncestor,
    });
  }
  return out;
}

/**
 * Cells at `resolution` that cover Shadow plus a `rings`-cell halo around
 * them. For Shadow's 89 res-6 cells, this yields ~3-15 res-4 cells depending
 * on `rings`.
 */
export function shadowHaloCells(
  shadowRes6Cells: string[],
  resolution: number,
  rings: number,
): string[] {
  const parents = new Set<string>();
  for (const c of shadowRes6Cells) parents.add(cellToParent(c, resolution));
  const expanded = new Set<string>();
  for (const p of parents) {
    for (const n of gridDisk(p, rings)) expanded.add(n);
  }
  return Array.from(expanded);
}

/**
 * The `count` cells adjacent to `originCell` that hold the most Shadow
 * res-6 descendants, falling back to ring order when fewer than `count`
 * neighbors contain Shadow cells.
 */
export function shadowStartingCells(
  originCell: string,
  shadowRes6Cells: string[],
  resolution: number,
  count: number,
): string[] {
  const descendantCount = new Map<string, number>();
  for (const c of shadowRes6Cells) {
    const ancestor = cellToParent(c, resolution);
    descendantCount.set(ancestor, (descendantCount.get(ancestor) ?? 0) + 1);
  }
  const ring = gridDisk(originCell, 1).filter(c => c !== originCell);
  const scored = ring.map((c, i) => ({
    c,
    count: descendantCount.get(c) ?? 0,
    ringIdx: i,
  }));
  scored.sort((a, b) => b.count - a.count || a.ringIdx - b.ringIdx);
  return scored.slice(0, count).map(s => s.c);
}

export function prepareResolution(
  resolution: number,
  shadowRes6Cells: string[],
  anchorCell: string,
): PreparedCell[] {
  const shadowCount = new Map<string, number>();
  for (const c of shadowRes6Cells) {
    const ancestor = cellToParent(c, resolution);
    shadowCount.set(ancestor, (shadowCount.get(ancestor) ?? 0) + 1);
  }
  const anchorAncestor = cellToParent(anchorCell, resolution);

  const cells = listCellsAtResolution(resolution);
  const out: PreparedCell[] = [];
  for (const cell of cells) {
    const boundary = cellToBoundary(cell).map(
      ([lat, lng]) =>
        [Math.round(lat * 10000) / 10000, Math.round(lng * 10000) / 10000] as [number, number],
    );
    const [cLat, cLng] = cellToLatLng(cell);
    out.push({
      cell,
      resolution,
      boundary,
      center: [Math.round(cLat * 10000) / 10000, Math.round(cLng * 10000) / 10000],
      isPentagon: isPentagon(cell),
      shadowDescendantCount: shadowCount.get(cell) ?? 0,
      isAnchorAncestor: cell === anchorAncestor,
    });
  }
  return out;
}
