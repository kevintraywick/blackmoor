export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import DmNav from '@/components/DmNav';
import H3DebugClient, { type PreparedPolygon } from '@/components/dm/H3DebugClient';
import { getWorldAnchor } from '@/lib/world-anchor';
import { qrToH3Cell } from '@/lib/world-hex-mapping';
import { cellToBoundary, cellToLatLng, cellArea, isPentagon } from 'h3-js';

interface HexRow {
  q: number;
  r: number;
  h3_cell: string | null;
  reveal_state: string;
  terrain_type: string | null;
  local_map_id: string | null;
}

interface WorldMapRow {
  party_q: number | null;
  party_r: number | null;
}

const SVG_W = 1100;
const SVG_H = 720;
const PAD = 40;

function colorFor(opts: {
  reveal_state: string;
  isAnchor: boolean;
  isPartyCell: boolean;
  isPent: boolean;
}): { fill: string; stroke: string } {
  if (opts.isAnchor) return { fill: '#8a4444', stroke: '#d98a8a' };
  if (opts.isPartyCell) return { fill: '#6e5a28', stroke: '#e4c96a' };
  if (opts.isPent) return { fill: '#3c4a7a', stroke: '#8aa0e0' };
  switch (opts.reveal_state) {
    case 'mapped':
      return { fill: '#2d4a3a', stroke: '#5aa080' };
    case 'revealed':
      return { fill: '#3a342b', stroke: '#9a8658' };
    default:
      return { fill: '#22201d', stroke: '#4a4037' };
  }
}

export default async function H3DebugPage() {
  await ensureSchema();

  const hexes = await query<HexRow>(
    `SELECT q, r, h3_cell::text AS h3_cell, reveal_state, terrain_type, local_map_id
     FROM world_hexes
     WHERE h3_cell IS NOT NULL
     ORDER BY q, r`,
  );

  const [worldMap] = await query<WorldMapRow>(
    `SELECT party_q, party_r FROM world_map WHERE id = 'default'`,
  );

  const anchor = await getWorldAnchor();
  const partyCell =
    worldMap?.party_q != null && worldMap?.party_r != null
      ? qrToH3Cell(worldMap.party_q, worldMap.party_r)
      : null;

  // Build the work set: all stored hexes, plus the anchor (synthetic if it
  // isn't already in the hex set).
  const hexByCell = new Map<string, HexRow>();
  for (const h of hexes) {
    hexByCell.set(BigInt(h.h3_cell!).toString(16), h);
  }
  const anchorInSet = hexByCell.has(anchor.cell);

  // Collect lat/lng for every vertex so we can fit the view. Do it once;
  // floating-point noise here only affects the bounding box, which doesn't
  // reach the DOM.
  const allCells = [...hexByCell.keys()];
  if (!anchorInSet) allCells.push(anchor.cell);

  const boundaries = new Map<string, Array<[number, number]>>();
  for (const cell of allCells) boundaries.set(cell, cellToBoundary(cell));

  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const boundary of boundaries.values()) {
    for (const [lat, lng] of boundary) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }

  const centerLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((centerLat * Math.PI) / 180);
  const dataW = (maxLng - minLng) * lngScale;
  const dataH = maxLat - minLat;
  const viewW = SVG_W - PAD * 2;
  const viewH = SVG_H - PAD * 2;
  const scale = Math.min(viewW / dataW, viewH / dataH);
  const offsetX = (viewW - dataW * scale) / 2 + PAD;
  const offsetY = (viewH - dataH * scale) / 2 + PAD;

  // Round to 2 decimals on the way out — far more than enough precision for
  // 1100x720 pixels, and it dodges any lingering hydration risk even though
  // this payload is server-computed.
  const project = (lat: number, lng: number): [number, number] => {
    const x = offsetX + (lng - minLng) * lngScale * scale;
    const y = offsetY + (maxLat - lat) * scale;
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  };

  const polygons: PreparedPolygon[] = [];
  for (const [cell, boundary] of boundaries) {
    const hex = hexByCell.get(cell);
    const isAnchor = cell === anchor.cell;
    const isPartyCell = cell === partyCell;
    const pent = isPentagon(cell);
    const { fill, stroke } = colorFor({
      reveal_state: hex?.reveal_state ?? 'unrevealed',
      isAnchor,
      isPartyCell,
      isPent: pent,
    });
    const [cLat, cLng] = cellToLatLng(cell);
    polygons.push({
      cell,
      q: hex?.q ?? null,
      r: hex?.r ?? null,
      reveal_state: hex?.reveal_state ?? 'unrevealed',
      terrain_type: hex?.terrain_type ?? null,
      local_map_id: hex?.local_map_id ?? null,
      points: boundary.map(([lat, lng]) => project(lat, lng).join(',')).join(' '),
      fill,
      stroke,
      isAnchor,
      isPartyCell,
      isPentagon: pent,
      isSynthetic: !hex,
      centerLat: Math.round(cLat * 10000) / 10000,
      centerLng: Math.round(cLng * 10000) / 10000,
      areaKm2: Math.round(cellArea(cell, 'km2') * 100) / 100,
    });
  }

  const anchorLatLng = cellToLatLng(anchor.cell);
  const anchorPx = project(anchorLatLng[0], anchorLatLng[1]);
  const partyPx = partyCell ? (() => {
    const [la, lo] = cellToLatLng(partyCell);
    return project(la, lo);
  })() : null;

  const counts = {
    mapped: hexes.filter((h) => h.reveal_state === 'mapped').length,
    revealed: hexes.filter((h) => h.reveal_state === 'revealed').length,
    unrevealed: hexes.filter((h) => h.reveal_state === 'unrevealed').length,
    total: hexes.length,
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="world" />
      <div className="px-6 py-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-serif mb-2">H3 grid — debug view</h1>
        <p className="text-sm opacity-70 mb-6">
          Each polygon is a real H3 cell (res 6, ~6.2 km flat-to-flat) rendered
          from <code>cellToBoundary()</code> vertices, projected equirectangularly
          around Blaen Hafren. Polygons are pre-computed server-side to avoid
          trig hydration drift between Node and the browser. This is the visual
          sanity check that v3&apos;s H3 substrate is wired up correctly.
        </p>
        <H3DebugClient
          polygons={polygons}
          anchorCell={anchor.cell}
          anchorResolution={anchor.resolution}
          anchorPx={anchorPx}
          partyPx={partyPx}
          party={worldMap?.party_q != null && worldMap?.party_r != null
            ? { q: worldMap.party_q, r: worldMap.party_r }
            : null}
          viewBox={{ width: SVG_W, height: SVG_H }}
          bbox={{ minLat, maxLat, minLng, maxLng }}
          counts={counts}
        />
      </div>
    </div>
  );
}
