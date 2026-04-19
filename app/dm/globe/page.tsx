export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import DmNav from '@/components/DmNav';
import GlobeClient, { type PreparedCell } from '@/components/dm/GlobeClient';
import { getWorldAnchor } from '@/lib/world-anchor';
import { cellToBoundary, cellToLatLng, cellToParent, getRes0Cells, cellToChildren, isPentagon } from 'h3-js';

/**
 * Pre-compute every cell at a given resolution. h3-js doesn't ship a
 * direct "list all cells at res N" — we walk from res 0 down.
 */
function listCellsAtResolution(resolution: number): string[] {
  if (resolution === 0) return getRes0Cells();
  const prev = listCellsAtResolution(resolution - 1);
  const out: string[] = [];
  for (const parent of prev) {
    for (const child of cellToChildren(parent, resolution)) out.push(child);
  }
  return out;
}

function prepareResolution(
  resolution: number,
  shadowRes6Cells: string[],
  anchorCell: string,
): PreparedCell[] {
  // Roll Shadow's res-6 cells up to this resolution, and count descendants.
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
        // Round to 4 decimals — that's ≈11m precision at the equator, plenty
        // for a globe overview and keeps the JSON payload small.
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

export default async function GlobePage() {
  await ensureSchema();

  const rows = await query<{ h3_cell: string | null }>(
    `SELECT h3_cell::text AS h3_cell FROM world_hexes WHERE h3_cell IS NOT NULL`,
  );
  const shadowRes6Cells = rows
    .map(r => (r.h3_cell !== null ? BigInt(r.h3_cell).toString(16) : null))
    .filter((c): c is string => c !== null);

  const anchor = await getWorldAnchor();
  const [anchorLat, anchorLng] = cellToLatLng(anchor.cell);

  const res1Cells = prepareResolution(1, shadowRes6Cells, anchor.cell);
  const res2Cells = prepareResolution(2, shadowRes6Cells, anchor.cell);

  const shadowRes1Count = res1Cells.filter(c => c.shadowDescendantCount > 0).length;
  const shadowRes2Count = res2Cells.filter(c => c.shadowDescendantCount > 0).length;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="world" />
      <div className="px-6 py-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-serif mb-2">World — orthographic view</h1>
        <p className="text-sm opacity-70 mb-4">
          The Common World at planetary scale. Drag to rotate. Scroll to zoom in —
          past a threshold the grid swaps from res 1 (842 cells, ≈150 km) down to
          res 2 (5,882 cells, ≈60 km). Shadow&apos;s {shadowRes6Cells.length} touched
          res-6 hexes roll up to {shadowRes1Count} res-1 ancestors ({shadowRes2Count} at res 2).
        </p>
        <GlobeClient
          res1Cells={res1Cells}
          res2Cells={res2Cells}
          anchorCell={anchor.cell}
          anchorLat={anchorLat}
          anchorLng={anchorLng}
          anchorName="Blaen Hafren"
        />
      </div>
    </div>
  );
}
