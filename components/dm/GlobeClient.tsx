'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PreparedCell } from '@/lib/h3-world-data';

export type { PreparedCell };

interface Props {
  res1Cells: PreparedCell[];
  res2Cells: PreparedCell[];
  anchorCell: string;
  anchorLat: number;
  anchorLng: number;
  anchorName: string;
}

const CANVAS_W = 900;
const CANVAS_H = 900;

// Globe radius in pixels at zoom=1. Canvas is square; globe fills ~90% of it.
const R_BASE = (CANVAS_W / 2) * 0.9;

// Zoom at/past which we auto-switch from res 1 to res 2.
const RES_SWITCH_ZOOM = 2.5;

const RAD = Math.PI / 180;

function project(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  R: number,
  cx: number,
  cy: number,
): { x: number; y: number; visible: boolean } {
  const φ1 = centerLat * RAD;
  const λ0 = centerLng * RAD;
  const φ = lat * RAD;
  const λ = lng * RAD;
  const cosC = Math.sin(φ1) * Math.sin(φ) + Math.cos(φ1) * Math.cos(φ) * Math.cos(λ - λ0);
  const x = Math.cos(φ) * Math.sin(λ - λ0);
  const y = Math.cos(φ1) * Math.sin(φ) - Math.sin(φ1) * Math.cos(φ) * Math.cos(λ - λ0);
  return { x: cx + x * R, y: cy - y * R, visible: cosC > 0 };
}

// Common World palette — cosmic-navy base with warm/violet accents.
// Explicitly not Shadow's firelit-brown: CW is a planetary, shared space,
// not a hearth-room. Saturated soft blues + warm pops for agency cues.
const COLOR_SPACE = '#0a0f20';         // cosmic navy (behind globe)
const COLOR_OCEAN = '#172540';         // globe disk (slight lift vs space)
const COLOR_RIM = '#3e5683';           // horizon stroke
const COLOR_CELL_FILL = '#2b3e67';     // default cell fill — slate-blue
const COLOR_CELL_STROKE = '#5880b4';   // default cell stroke — periwinkle
const COLOR_ANCHOR_FILL = '#f06282';   // containing cell — coral rose
const COLOR_ANCHOR_STROKE = '#ffb5c5';
const COLOR_ANCHOR_ANCESTOR_FILL = '#d94668';
const COLOR_ANCHOR_ANCESTOR_STROKE = '#ff8fa0';
const COLOR_PENTAGON_FILL = '#000000'; // astral void — black (absence)
const COLOR_PENTAGON_STROKE = '#a080f5'; // violet rim keeps the shape readable
const COLOR_SHADOW_STROKE = '#ffd060'; // Shadow presence stroke
const COLOR_ANCHOR_LABEL = '#ffb5c5';

function colorForCell(c: PreparedCell, isAnchorCell: boolean): { fill: string; stroke: string } {
  if (isAnchorCell) return { fill: COLOR_ANCHOR_FILL, stroke: COLOR_ANCHOR_STROKE };
  if (c.isAnchorAncestor) return { fill: COLOR_ANCHOR_ANCESTOR_FILL, stroke: COLOR_ANCHOR_ANCESTOR_STROKE };
  if (c.isPentagon) return { fill: COLOR_PENTAGON_FILL, stroke: COLOR_PENTAGON_STROKE };
  if (c.shadowDescendantCount > 0) {
    // Warm amber ramp — bronze → bright gold with density (caps at 7).
    const t = Math.min(1, c.shadowDescendantCount / 7);
    const r = Math.round(200 + t * 55);
    const g = Math.round(130 + t * 78);
    const b = Math.round(56 + t * 40);
    return { fill: `rgb(${r},${g},${b})`, stroke: COLOR_SHADOW_STROKE };
  }
  return { fill: COLOR_CELL_FILL, stroke: COLOR_CELL_STROKE };
}

export default function GlobeClient({ res1Cells, res2Cells, anchorCell, anchorLat, anchorLng, anchorName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [centerLat, setCenterLat] = useState(anchorLat);
  const [centerLng, setCenterLng] = useState(anchorLng);
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<PreparedCell | null>(null);

  // Drag-to-rotate state in refs (doesn't trigger re-render on pointer move).
  const dragRef = useRef<{ startX: number; startY: number; startLat: number; startLng: number } | null>(null);

  const activeRes = zoom >= RES_SWITCH_ZOOM ? 2 : 1;
  const activeCells = activeRes === 2 ? res2Cells : res1Cells;

  const R = R_BASE * zoom;
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;

  // Precompute an index we'll use for hit-testing + anchor highlight lookup.
  const cellByCell = useMemo(() => {
    const m = new Map<string, PreparedCell>();
    for (const c of activeCells) m.set(c.cell, c);
    return m;
  }, [activeCells]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== CANVAS_W * dpr || canvas.height !== CANVAS_H * dpr) {
      canvas.width = CANVAS_W * dpr;
      canvas.height = CANVAS_H * dpr;
      canvas.style.width = `${CANVAS_W}px`;
      canvas.style.height = `${CANVAS_H}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background — cosmic navy
    ctx.fillStyle = COLOR_SPACE;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Ocean disk (globe silhouette) — slight lift vs space for depth
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_OCEAN;
    ctx.fill();

    // Cells
    for (const c of activeCells) {
      // Project every vertex; cull if ALL points are on back hemisphere.
      const pts: { x: number; y: number; visible: boolean }[] = [];
      let anyVisible = false;
      for (const [lat, lng] of c.boundary) {
        const p = project(lat, lng, centerLat, centerLng, R, cx, cy);
        pts.push(p);
        if (p.visible) anyVisible = true;
      }
      if (!anyVisible) continue;

      // Skip cells that span the horizon messily — simplest heuristic: if any
      // vertex is behind the horizon, skip. Losing slivers at the rim is
      // acceptable for a first pass; prevents long chords across the globe.
      if (pts.some(p => !p.visible)) continue;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();

      const isAnchorCell = c.cell === anchorCell;
      const { fill, stroke } = colorForCell(c, isAnchorCell);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = isAnchorCell || c.isAnchorAncestor ? 1.5 : c.isPentagon ? 1.25 : 0.6;
      ctx.stroke();
    }

    // Res-1 overlay — always draw. At res-1 base this emphasizes the active
    // cells; at res-2 base it surfaces the country-scale parent lattice
    // through the region-scale grid. Dark stroke underneath then white on
    // top gives the lines readable contrast against both warm and blue fills.
    for (const c of res1Cells) {
      const pts: { x: number; y: number; visible: boolean }[] = [];
      let anyVisible = false;
      for (const [lat, lng] of c.boundary) {
        const p = project(lat, lng, centerLat, centerLng, R, cx, cy);
        pts.push(p);
        if (p.visible) anyVisible = true;
      }
      if (!anyVisible) continue;
      if (pts.some(p => !p.visible)) continue;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();

      // dark halo
      ctx.strokeStyle = 'rgba(10, 15, 32, 0.75)';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      // white rim
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 1.75;
      ctx.stroke();
    }

    // Anchor marker — always draw on top with a label
    const anchorProj = project(anchorLat, anchorLng, centerLat, centerLng, R, cx, cy);
    if (anchorProj.visible) {
      ctx.beginPath();
      ctx.arc(anchorProj.x, anchorProj.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_ANCHOR_LABEL;
      ctx.strokeStyle = COLOR_SPACE;
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();

      ctx.font = `500 12px "Geist", sans-serif`;
      ctx.fillStyle = COLOR_ANCHOR_LABEL;
      ctx.fillText(anchorName, anchorProj.x + 8, anchorProj.y + 4);
    }

    // Globe rim — periwinkle halo
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = COLOR_RIM;
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [activeCells, res1Cells, centerLat, centerLng, R, cx, cy, anchorCell, anchorLat, anchorLng, anchorName]);

  useEffect(() => { draw(); }, [draw]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLat: centerLat,
      startLng: centerLng,
    };
  }, [centerLat, centerLng]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      // Degrees of rotation per pixel. Scaled by 1/zoom so feel stays consistent.
      const degPerPx = 0.4 / zoom;
      let nextLng = drag.startLng - dx * degPerPx;
      // wrap
      while (nextLng > 180) nextLng -= 360;
      while (nextLng < -180) nextLng += 360;
      let nextLat = drag.startLat + dy * degPerPx;
      // clamp to avoid flipping past poles
      nextLat = Math.max(-85, Math.min(85, nextLat));
      setCenterLat(nextLat);
      setCenterLng(nextLng);
      setHovered(null);
      return;
    }

    // Hit test for hover — only when not dragging.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // Quick out if outside the globe disk.
    const dx = sx - cx, dy = sy - cy;
    if (dx * dx + dy * dy > R * R) { setHovered(null); return; }
    // Find a cell whose projected center is closest to the cursor; pick if
    // within a tolerance. Not polygon-accurate but close enough for a
    // planetary overview.
    let best: PreparedCell | null = null;
    let bestDist = Infinity;
    const toleranceSq = (activeRes === 2 ? 30 : 60) ** 2;
    for (const c of activeCells) {
      const p = project(c.center[0], c.center[1], centerLat, centerLng, R, cx, cy);
      if (!p.visible) continue;
      const ddx = p.x - sx, ddy = p.y - sy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < bestDist && d2 < toleranceSq) {
        bestDist = d2;
        best = c;
      }
    }
    setHovered(best);
  }, [zoom, centerLat, centerLng, R, cx, cy, activeCells, activeRes]);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);
  const onPointerLeave = useCallback(() => { dragRef.current = null; setHovered(null); }, []);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom(z => Math.max(0.6, Math.min(8, z * factor)));
  }, []);

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs font-sans flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
        <span>
          Active: <strong>res {activeRes}</strong> ({activeCells.length.toLocaleString()} cells) ·
          Zoom: <strong>{zoom.toFixed(2)}×</strong>
        </span>
        <LegendChip fill={COLOR_ANCHOR_ANCESTOR_FILL} stroke={COLOR_ANCHOR_ANCESTOR_STROKE} label="Shadow's home cell" />
        <LegendChip fill="#e89a48" stroke={COLOR_SHADOW_STROKE} label="Shadow presence (res-6 density)" />
        <LegendChip fill={COLOR_PENTAGON_FILL} stroke={COLOR_PENTAGON_STROKE} label="Astral void (pentagon)" />
        <button
          type="button"
          onClick={() => { setCenterLat(anchorLat); setCenterLng(anchorLng); setZoom(1); }}
          className="ml-auto text-[0.7rem] uppercase tracking-[0.15em] font-sans transition-colors"
          style={{ background: 'transparent', border: `1px solid ${COLOR_RIM}`, color: '#8aa0c8', cursor: 'pointer', padding: '4px 10px' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#d0e0ff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8aa0c8'; }}
        >
          Recenter
        </button>
      </div>

      <div
        className="relative rounded-sm overflow-hidden"
        style={{ background: COLOR_SPACE, border: `1px solid ${COLOR_RIM}`, width: CANVAS_W, maxWidth: '100%' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onWheel={onWheel}
          style={{ display: 'block', cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        />

        {hovered && (
          <div
            className="absolute bottom-2 left-2 px-3 py-2 text-xs font-mono rounded-sm"
            style={{ background: 'rgba(10, 15, 32, 0.94)', border: `1px solid ${COLOR_RIM}`, color: '#d0e0ff', maxWidth: 420, pointerEvents: 'none' }}
          >
            <div>
              cell: {hovered.cell} · res {hovered.resolution}
              {hovered.isPentagon ? ' · PENTAGON' : ''}
            </div>
            <div className="opacity-70">
              center: {hovered.center[0].toFixed(3)}, {hovered.center[1].toFixed(3)}
            </div>
            {hovered.shadowDescendantCount > 0 && (
              <div className="opacity-90" style={{ color: COLOR_SHADOW_STROKE }}>
                Shadow: {hovered.shadowDescendantCount} res-6 hex{hovered.shadowDescendantCount === 1 ? '' : 'es'} inside
              </div>
            )}
            {hovered.isAnchorAncestor && (
              <div className="opacity-90" style={{ color: COLOR_ANCHOR_LABEL }}>
                Contains Blaen Hafren
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs font-sans opacity-60">
        Drag to rotate · Scroll to zoom · Auto-switches to res 2 at {RES_SWITCH_ZOOM.toFixed(1)}× zoom · Recenter returns you to Blaen Hafren
      </div>
    </div>
  );
}

function LegendChip({ fill, stroke, label }: { fill: string; stroke: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block" style={{ width: 14, height: 14, background: fill, border: `1px solid ${stroke}`, borderRadius: 2 }} />
      <span>{label}</span>
    </span>
  );
}
