export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import DmNav from '@/components/DmNav';
import Globe3DClient from '@/components/dm/Globe3DClient';
import { getWorldAnchor } from '@/lib/world-anchor';
import { cellToLatLng } from 'h3-js';
import { prepareResolution } from '@/lib/h3-world-data';

export default async function Globe3DPage() {
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

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="world" />
      <div className="px-6 py-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-serif mb-2">World — 3D globe</h1>
        <p className="text-sm opacity-70 mb-4">
          A real sphere this time. Drag to spin. Scroll to zoom — past a
          threshold the fill swaps from res 1 to res 2. The res-1 lattice
          stays overlaid in white at every distance so the parent structure
          is always legible.
        </p>
        <Globe3DClient
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
