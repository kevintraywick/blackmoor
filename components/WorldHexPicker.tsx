'use client';

// World hex picker — modal overlay used by the map builder editor's
// "Set world location" action. Loads the world hex grid, lets the DM click
// a target hex, and confirms the placement. Persistence happens in the
// caller via POST /api/map-builder/[id]/world-location.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hexCenter, hexPath } from '@/lib/hex-math';
import type { WorldHex } from '@/lib/world';

const HEX_SIZE = 28;
const CANVAS_W = 880;
const CANVAS_H = 520;
const UNREVEALED_PAD = 4;

const COLOR_BG = '#12100d';
const COLOR_UNREVEALED_FILL = '#1f1a16';
const COLOR_UNREVEALED_STROKE = '#2c241d';
const COLOR_REVEALED_FILL = '#3b2e23';
const COLOR_REVEALED_STROKE = '#5a4632';
const COLOR_MAPPED_FILL = '#4a3a24';
const COLOR_MAPPED_STROKE = '#c9a84c';
const COLOR_SELECTED_STROKE = '#7ac28a';
const COLOR_HOVER_STROKE = '#e6c66a';
const COLOR_OWN_FILL = '#5a4a2e';

function pixelToHexUnbounded(px: number, py: number, hexSize: number): [number, number] {
  const h = hexSize * Math.sqrt(3);
  const x = px - hexSize;
  const y = py - h / 2;

  const q = (2 / 3 * x) / hexSize;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / hexSize;
  const s = -q - r;

  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;

  const col = rq;
  const row = rr + Math.floor(rq / 2);
  return [col, row];
}

interface Props {
  buildId: string;
  buildName: string;
  currentAnchor: { q: number; r: number } | null;
  onCancel: () => void;
  onPlaced: (q: number, r: number) => void;
}

export default function WorldHexPicker({ buildId, buildName, currentAnchor, onCancel, onPlaced }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hexes, setHexes] = useState<WorldHex[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<[number, number] | null>(
    currentAnchor ? [currentAnchor.q, currentAnchor.r] : null
  );
  const [placing, setPlacing] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  // Load hexes on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/world/hexes')
      .then((r) => r.json())
      .then((data: WorldHex[]) => {
        if (cancelled) return;
        setHexes(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Center the viewport on the current anchor (if any) or the centroid
  const initialPan = useMemo(() => {
    const focusQ = currentAnchor?.q ?? (hexes.length === 0 ? 0 : hexes.reduce((s, h) => s + h.q, 0) / hexes.length);
    const focusR = currentAnchor?.r ?? (hexes.length === 0 ? 0 : hexes.reduce((s, h) => s + h.r, 0) / hexes.length);
    const { cx, cy } = hexCenter(Math.round(focusQ), Math.round(focusR), HEX_SIZE);
    return { x: CANVAS_W / 2 - cx, y: CANVAS_H / 2 - cy };
  }, [currentAnchor, hexes]);

  const hexMap = useMemo(() => {
    const m = new Map<string, WorldHex>();
    for (const h of hexes) m.set(`${h.q},${h.r}`, h);
    return m;
  }, [hexes]);

  const drawWindow = useMemo(() => {
    if (hexes.length === 0) {
      return { minQ: -8, maxQ: 8, minR: -6, maxR: 6 };
    }
    let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
    for (const h of hexes) {
      if (h.q < minQ) minQ = h.q;
      if (h.q > maxQ) maxQ = h.q;
      if (h.r < minR) minR = h.r;
      if (h.r > maxR) maxR = h.r;
    }
    return {
      minQ: minQ - UNREVEALED_PAD,
      maxQ: maxQ + UNREVEALED_PAD,
      minR: minR - UNREVEALED_PAD,
      maxR: maxR + UNREVEALED_PAD,
    };
  }, [hexes]);

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

    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    ctx.translate(initialPan.x, initialPan.y);

    for (let q = drawWindow.minQ; q <= drawWindow.maxQ; q++) {
      for (let r = drawWindow.minR; r <= drawWindow.maxR; r++) {
        const { cx, cy } = hexCenter(q, r, HEX_SIZE);
        const known = hexMap.get(`${q},${r}`);
        const state = known?.reveal_state ?? 'unrevealed';
        const isOwn = known?.local_map_id === buildId;

        hexPath(ctx, cx, cy, HEX_SIZE);

        if (isOwn) {
          ctx.fillStyle = COLOR_OWN_FILL;
          ctx.strokeStyle = COLOR_MAPPED_STROKE;
          ctx.lineWidth = 2;
        } else if (state === 'unrevealed') {
          ctx.fillStyle = COLOR_UNREVEALED_FILL;
          ctx.strokeStyle = COLOR_UNREVEALED_STROKE;
          ctx.lineWidth = 1;
        } else if (state === 'revealed') {
          ctx.fillStyle = COLOR_REVEALED_FILL;
          ctx.strokeStyle = COLOR_REVEALED_STROKE;
          ctx.lineWidth = 1.5;
        } else {
          ctx.fillStyle = COLOR_MAPPED_FILL;
          ctx.strokeStyle = COLOR_MAPPED_STROKE;
          ctx.lineWidth = 2;
        }
        ctx.fill();
        ctx.stroke();

        if (state === 'mapped' && !isOwn) {
          ctx.fillStyle = COLOR_MAPPED_STROKE;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        if (selected && selected[0] === q && selected[1] === r) {
          hexPath(ctx, cx, cy, HEX_SIZE);
          ctx.strokeStyle = COLOR_SELECTED_STROKE;
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (hover && hover[0] === q && hover[1] === r) {
          hexPath(ctx, cx, cy, HEX_SIZE);
          ctx.strokeStyle = COLOR_HOVER_STROKE;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }, [hexMap, drawWindow, hover, selected, initialPan, buildId]);

  useEffect(() => {
    draw();
  }, [draw]);

  const screenToHex = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return pixelToHexUnbounded(sx - initialPan.x, sy - initialPan.y, HEX_SIZE);
    },
    [initialPan]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const [q, r] = screenToHex(e.clientX, e.clientY);
      if (!hover || hover[0] !== q || hover[1] !== r) setHover([q, r]);
    },
    [screenToHex, hover]
  );

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const [q, r] = screenToHex(e.clientX, e.clientY);
      const existing = hexMap.get(`${q},${r}`);
      if (existing?.reveal_state === 'mapped' && existing.local_map_id !== buildId) {
        setWarning(`Hex (${q}, ${r}) already holds another local map. Placing here will move that anchor.`);
      } else {
        setWarning(null);
      }
      setSelected([q, r]);
    },
    [screenToHex, hexMap, buildId]
  );

  const place = useCallback(async () => {
    if (!selected) return;
    setPlacing(true);
    try {
      const res = await fetch(`/api/map-builder/${buildId}/world-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: selected[0], r: selected[1] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setWarning(err.error || 'Failed to set world location');
        setPlacing(false);
        return;
      }
      onPlaced(selected[0], selected[1]);
    } catch (err) {
      console.warn('place error', err);
      setWarning('Network error');
      setPlacing(false);
    }
  }, [selected, buildId, onPlaced]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(8, 6, 4, 0.82)' }}
    >
      <div
        className="bg-[#1a1614] border border-[#5a4632] rounded"
        style={{ padding: 24 }}
      >
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7a4c] font-sans">
              Set World Location
            </p>
            <h2 className="font-serif text-[1.25rem] italic text-[#e8dcc4] leading-tight mt-0.5">
              {buildName || 'Untitled'}
            </h2>
          </div>
          <p className="text-[0.7rem] text-[#6a5a3c] font-sans uppercase tracking-[0.15em]">
            {loading ? 'Loading…' : `${hexes.length} hex${hexes.length === 1 ? '' : 'es'} touched`}
          </p>
        </div>

        <canvas
          ref={canvasRef}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHover(null)}
          onClick={onClick}
          style={{
            display: 'block',
            width: CANVAS_W,
            height: CANVAS_H,
            border: '1px solid #2c241d',
            borderRadius: 2,
            cursor: 'crosshair',
          }}
        />

        <div className="flex items-center justify-between mt-4">
          <div className="text-[0.78rem] font-serif italic">
            {selected ? (
              <span className="text-[#c9a84c]">
                Place <span className="text-[#e8dcc4]">{buildName || 'this map'}</span> at hex ({selected[0]}, {selected[1]})
              </span>
            ) : (
              <span className="text-[#6a5a3c]">Click a hex to select.</span>
            )}
            {warning && (
              <div className="text-[#c07a8a] text-[0.7rem] mt-1 not-italic">{warning}</div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={placing}
              className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7a4c] hover:text-[#c9a84c] font-sans"
              style={{ background: 'transparent', border: '1px solid #5a4632', cursor: 'pointer', padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={place}
              disabled={!selected || placing}
              className="text-[0.7rem] uppercase tracking-[0.15em] font-sans"
              style={{
                background: selected ? '#c9a84c' : '#3a3024',
                color: selected ? '#1a1614' : '#6a5a3c',
                border: '1px solid #5a4632',
                cursor: selected && !placing ? 'pointer' : 'not-allowed',
                padding: '8px 16px',
              }}
            >
              {placing ? 'Placing…' : 'Place Here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
