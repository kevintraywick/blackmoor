export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import DmNav from '@/components/DmNav';
import GlobeClient from '@/components/dm/GlobeClient';
import { getWorldAnchor } from '@/lib/world-anchor';
import { cellToLatLng, cellToParent, gridDisk, gridDiskDistances } from 'h3-js';
import { campaignCells, eligibleOriginCellsInContainingParent, prepareCells, prepareResolution } from '@/lib/h3-world-data';
import { fetchCloudCoverByCell } from '@/lib/open-meteo-clouds';

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

  const res0Cells = prepareResolution(0, shadowRes6Cells, anchor.cell);
  const res1Cells = prepareResolution(1, shadowRes6Cells, anchor.cell);
  const res2Cells = prepareResolution(2, shadowRes6Cells, anchor.cell);
  const res3Cells = prepareResolution(3, shadowRes6Cells, anchor.cell);

  // Shadow's campaign = origin (anchor's res-4 parent) + 6 adjacent hexes.
  const originCell = cellToParent(anchor.cell, 4);
  const res4CampaignCells = prepareCells(campaignCells(originCell), 4, shadowRes6Cells, anchor.cell);

  // Eligible origins: all 49 res-4 descendants of the res-2 hex containing
  // Shadow's origin, minus any overlap with Shadow's 7-hex campaign.
  const res4EligibleCells = prepareCells(
    eligibleOriginCellsInContainingParent(originCell, 2),
    4,
    shadowRes6Cells,
    anchor.cell,
  );

  // Placed map builds — DM-dropped maps anchored to res-4 hexes via the
  // /globe-placement route. Renders as gold-outlined "mapped" hexes that
  // navigate back into the builder when clicked.
  const placedRows = await query<{
    id: string;
    name: string;
    h3_cell: string | null;
    placement_offset_col: number;
    placement_offset_row: number;
  }>(
    `SELECT id, name, h3_cell::text AS h3_cell, placement_offset_col, placement_offset_row
     FROM map_builds
     WHERE h3_cell IS NOT NULL AND h3_res = 4
     ORDER BY updated_at DESC`,
  );
  const placedMaps = placedRows
    .map(r => ({
      id: r.id,
      name: r.name,
      cell: r.h3_cell ? BigInt(r.h3_cell).toString(16).padStart(15, '0') : '',
      offsetCol: r.placement_offset_col ?? 0,
      offsetRow: r.placement_offset_row ?? 0,
    }))
    .filter(p => p.cell);
  const placedMapCells = prepareCells(
    Array.from(new Set(placedMaps.map(p => p.cell))),
    4,
    shadowRes6Cells,
    anchor.cell,
  );

  // Regional fiction map → painted on the globe in place of Blue Marble.
  // Single-anchor projection (Pearl Beacon → Aberystwyth), N=up, no mirror,
  // scale derived from the printed mile bar on the source image.
  const REGIONAL_KM_PER_PX = 161 / 750; // 100 mi / 750 px → 0.2147 km/px
  const [regionalRow] = await query<{
    id: string;
    image_path: string | null;
    image_width_px: number | null;
    image_height_px: number | null;
  }>(
    `SELECT id, image_path, image_width_px, image_height_px
       FROM map_builds
      WHERE map_role = 'regional' AND image_path IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 1`,
  );
  let regionalMap: {
    id: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    anchorPx: { x: number; y: number };
    anchorLatLng: { lat: number; lng: number };
    kmPerPx: number;
  } | null = null;
  if (regionalRow && regionalRow.image_width_px && regionalRow.image_height_px) {
    const [pearl] = await query<{
      image_px_x: number | null;
      image_px_y: number | null;
      real_lat: number;
      real_lng: number;
    }>(
      `SELECT image_px_x, image_px_y, real_lat, real_lng
         FROM regional_map_anchors
        WHERE build_id = $1 AND feature_name = $2`,
      [regionalRow.id, 'Pearl Beacon'],
    );
    if (pearl && pearl.image_px_x != null && pearl.image_px_y != null) {
      regionalMap = {
        id: regionalRow.id,
        imageUrl: `/api/map-builder/${regionalRow.id}/image`,
        imageWidth: regionalRow.image_width_px,
        imageHeight: regionalRow.image_height_px,
        anchorPx: { x: pearl.image_px_x, y: pearl.image_px_y },
        anchorLatLng: { lat: pearl.real_lat, lng: pearl.real_lng },
        kmPerPx: REGIONAL_KM_PER_PX,
      };
    }
  }

  // Numbered labels for res-2 hexes around Shadow's anchor — center hex (#1)
  // plus 7 grid rings outward (1+6+12+18+24+30+36+42 = 169 hexes). Numbered
  // ring-by-ring, then by H3 index for ties — so #1 is always the center.
  // gridDiskDistances groups by ring, which avoids gridDistance's pentagon
  // edge cases.
  const labelCenter = cellToParent(anchor.cell, 2);
  const ringsByDistance = gridDiskDistances(labelCenter, 7);
  // Precipitation cloud rule: walk the 10-ring of res-2 hexes around
  // Shadow's anchor (~331 cells), fetch live weather per centroid, render
  // a cloud at any hex with measurable precipitation. Replaces the global
  // N-hemi cloud-cover layers — clouds now mean "rain is happening here."
  const PRECIP_THRESHOLD_MM = 0.05;
  const PRECIP_RING_K = 10;
  const shadowRes2 = cellToParent(anchor.cell, 2);
  const ringCellIds = gridDisk(shadowRes2, PRECIP_RING_K);
  const ringCells = ringCellIds.map(cell => {
    const [lat, lng] = cellToLatLng(cell);
    return { cell, lat, lng };
  });
  const weatherByCell = await fetchCloudCoverByCell(ringCells);
  const liveCloudCellsPrecip = ringCells.filter(c => (weatherByCell.get(c.cell)?.precipMm ?? 0) >= PRECIP_THRESHOLD_MM);
  console.log(`[globe] Open-Meteo precip: ${weatherByCell.size}/${ringCells.length} res-2 hexes (k=${PRECIP_RING_K}) returned weather; precip ≥${PRECIP_THRESHOLD_MM}mm at ${liveCloudCellsPrecip.length} hexes`);

  const labeledRes2Cells = ringsByDistance
    .flatMap((ring, distance) => ring.map(cell => ({ cell, distance })))
    .sort((a, b) => a.distance - b.distance || a.cell.localeCompare(b.cell))
    .map(({ cell }, i) => {
      const [lat, lng] = cellToLatLng(cell);
      return { cell, lat, lng, number: i + 1 };
    });

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="world" />
      <GlobeClient
        res0Cells={res0Cells}
        res1Cells={res1Cells}
        res2Cells={res2Cells}
        res3Cells={res3Cells}
        res4CampaignCells={res4CampaignCells}
        res4EligibleCells={res4EligibleCells}
        placedMaps={placedMaps}
        placedMapCells={placedMapCells}
        regionalMap={regionalMap}
        labeledRes2Cells={labeledRes2Cells}
        liveCloudCellsPrecip={liveCloudCellsPrecip}
        anchorCell={anchor.cell}
        anchorLat={anchorLat}
        anchorLng={anchorLng}
      />
    </div>
  );
}
