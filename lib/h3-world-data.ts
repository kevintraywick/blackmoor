import { cellToBoundary, cellToLatLng, cellToParent, cellToChildren, getRes0Cells, isPentagon } from 'h3-js';

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
