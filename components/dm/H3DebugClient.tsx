'use client';

import { useState } from 'react';

export interface PreparedPolygon {
  cell: string;
  q: number | null;
  r: number | null;
  reveal_state: string;
  terrain_type: string | null;
  local_map_id: string | null;
  points: string;
  fill: string;
  stroke: string;
  isAnchor: boolean;
  isPartyCell: boolean;
  isPentagon: boolean;
  isSynthetic: boolean; // anchor rendered even if not in the hex set
  centerLat: number;
  centerLng: number;
  areaKm2: number;
}

interface Props {
  polygons: PreparedPolygon[];
  anchorCell: string;
  anchorResolution: number;
  anchorPx: [number, number];
  partyPx: [number, number] | null;
  party: { q: number; r: number } | null;
  viewBox: { width: number; height: number };
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  counts: { mapped: number; revealed: number; unrevealed: number; total: number };
}

export default function H3DebugClient({
  polygons,
  anchorCell,
  anchorResolution,
  anchorPx,
  partyPx,
  party,
  viewBox,
  bbox,
  counts,
}: Props) {
  const [hovered, setHovered] = useState<PreparedPolygon | null>(null);

  return (
    <div>
      {/* Legend */}
      <div
        className="mb-3 flex items-center gap-4 text-xs font-sans flex-wrap"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <LegendChip fill="#8a4444" stroke="#d98a8a" label={`Anchor — ${anchorCell} (res ${anchorResolution})`} />
        <LegendChip fill="#6e5a28" stroke="#e4c96a" label="Party" />
        <LegendChip fill="#3c4a7a" stroke="#8aa0e0" label="Pentagon (astral void)" />
        <LegendChip fill="#2d4a3a" stroke="#5aa080" label="Mapped" />
        <LegendChip fill="#3a342b" stroke="#9a8658" label="Revealed" />
        <span className="opacity-70">
          {counts.total} hexes ({counts.mapped} mapped, {counts.revealed} revealed, {counts.unrevealed} unrevealed)
        </span>
      </div>

      <div
        className="relative rounded-sm overflow-hidden"
        style={{ background: '#17140f', border: '1px solid #3d3530' }}
      >
        <svg width={viewBox.width} height={viewBox.height} style={{ display: 'block' }}>
          {polygons.map((p) => (
            <polygon
              key={p.cell}
              points={p.points}
              fill={p.fill}
              stroke={p.stroke}
              strokeWidth={p.isAnchor || p.isPartyCell ? 2 : 1}
              opacity={p.isSynthetic ? 0.45 : 0.92}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'crosshair' }}
            />
          ))}

          <g>
            <circle cx={anchorPx[0]} cy={anchorPx[1]} r={5} fill="#d98a8a" stroke="#17140f" strokeWidth={1} />
            <text
              x={anchorPx[0] + 9}
              y={anchorPx[1] + 4}
              fill="#d98a8a"
              fontSize={11}
              fontFamily="'Geist', sans-serif"
              style={{ pointerEvents: 'none' }}
            >
              Blaen Hafren
            </text>
          </g>

          {partyPx && party && (
            <g>
              <circle cx={partyPx[0]} cy={partyPx[1]} r={6} fill="#e4c96a" stroke="#17140f" strokeWidth={1} />
              <text
                x={partyPx[0] + 10}
                y={partyPx[1] + 4}
                fill="#e4c96a"
                fontSize={11}
                fontFamily="'Geist', sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                Party ({party.q},{party.r})
              </text>
            </g>
          )}
        </svg>

        {hovered && (
          <div
            className="absolute bottom-2 left-2 px-3 py-2 text-xs font-mono rounded-sm"
            style={{
              background: 'rgba(23, 20, 15, 0.92)',
              border: '1px solid #3d3530',
              color: 'var(--color-text)',
              maxWidth: 420,
            }}
          >
            <div>
              {hovered.q != null && hovered.r != null ? (
                <>
                  <strong>({hovered.q}, {hovered.r})</strong> · {hovered.reveal_state}
                </>
              ) : (
                <strong>(synthetic — anchor only)</strong>
              )}
              {hovered.terrain_type ? ` · ${hovered.terrain_type}` : ''}
              {hovered.local_map_id ? ' · has local map' : ''}
            </div>
            <div className="opacity-70">
              cell: {hovered.cell}
              {hovered.isPentagon ? ' · PENTAGON' : ''}
              {hovered.isAnchor ? ' · ANCHOR' : ''}
            </div>
            <div className="opacity-60">
              center: {hovered.centerLat.toFixed(4)}, {hovered.centerLng.toFixed(4)}
              {' · '}
              {hovered.areaKm2.toFixed(2)} km²
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 text-xs font-mono opacity-60">
        bbox: lat [{bbox.minLat.toFixed(3)}, {bbox.maxLat.toFixed(3)}] ·
        lng [{bbox.minLng.toFixed(3)}, {bbox.maxLng.toFixed(3)}]
      </div>
    </div>
  );
}

function LegendChip({ fill, stroke, label }: { fill: string; stroke: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block"
        style={{ width: 14, height: 14, background: fill, border: `1px solid ${stroke}`, borderRadius: 2 }}
      />
      <span>{label}</span>
    </span>
  );
}
