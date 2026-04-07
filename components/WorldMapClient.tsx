'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { hexCenter, hexPath } from '@/lib/hex-math';
import type { WorldHex, WorldMap } from '@/lib/world';

// ── Constants ───────────────────────────────────────────────────────────────

const HEX_SIZE = 36;        // screen px, flat-top radius
const CANVAS_W = 1200;
const CANVAS_H = 760;

// Extra ring of unrevealed hexes drawn around the bounding box of known hexes
// so the DM can always reach "one more hex outward."
const UNREVEALED_PAD = 4;

// Colors — warm browns + gold, per DESIGN.md
const COLOR_UNREVEALED_FILL = '#1f1a16';
const COLOR_UNREVEALED_STROKE = '#2c241d';
const COLOR_REVEALED_FILL = '#3b2e23';
const COLOR_REVEALED_STROKE = '#5a4632';
const COLOR_MAPPED_FILL = '#4a3a24';
const COLOR_MAPPED_STROKE = '#c9a84c';
const COLOR_HOVER_STROKE = '#e6c66a';

// ── Types ───────────────────────────────────────────────────────────────────

type Mode = 'reveal' | 'pan' | 'navigate';

interface Props {
  world: WorldMap;
  initialHexes: WorldHex[];
}

// ── Unbounded pixel→hex (allows negative coords) ────────────────────────────
// Mirrors lib/hex-math::pixelToHex but without the cols/rows bounds check.
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

  // Axial → even-q offset (matches hex-math.ts convention)
  const col = rq;
  const row = rr + Math.floor(rq / 2);
  return [col, row];
}

// ── Component ───────────────────────────────────────────────────────────────

export default function WorldMapClient({ world, initialHexes }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hexes, setHexes] = useState<WorldHex[]>(initialHexes);
  const [mode, setMode] = useState<Mode>('reveal');
  const [hover, setHover] = useState<[number, number] | null>(null);

  // Pan offset in world-space pixels. Initialized to center the centroid of
  // known hexes (or the origin if empty) on the canvas.
  const initialPan = useMemo(() => {
    const focus = searchParams.get('focus');
    if (focus) {
      const [fq, fr] = focus.split(',').map(Number);
      if (Number.isFinite(fq) && Number.isFinite(fr)) {
        const { cx, cy } = hexCenter(fq, fr, HEX_SIZE);
        return { x: CANVAS_W / 2 - cx, y: CANVAS_H / 2 - cy };
      }
    }
    if (hexes.length === 0) {
      const { cx, cy } = hexCenter(0, 0, HEX_SIZE);
      return { x: CANVAS_W / 2 - cx, y: CANVAS_H / 2 - cy };
    }
    let sumX = 0, sumY = 0;
    for (const h of hexes) {
      const { cx, cy } = hexCenter(h.q, h.r, HEX_SIZE);
      sumX += cx;
      sumY += cy;
    }
    const avgX = sumX / hexes.length;
    const avgY = sumY / hexes.length;
    return { x: CANVAS_W / 2 - avgX, y: CANVAS_H / 2 - avgY };
    // initialHexes is used for the centroid; recompute only on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pan, setPan] = useState(initialPan);
  const panDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Map of known hex state, keyed by "q,r"
  const hexMap = useMemo(() => {
    const m = new Map<string, WorldHex>();
    for (const h of hexes) m.set(`${h.q},${h.r}`, h);
    return m;
  }, [hexes]);

  // Bounding-box window of hexes to draw: the known hexes plus a padding ring.
  const drawWindow = useMemo(() => {
    if (hexes.length === 0) {
      return { minQ: -5, maxQ: 5, minR: -4, maxR: 4 };
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

    // DPR-aware sizing
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== CANVAS_W * dpr || canvas.height !== CANVAS_H * dpr) {
      canvas.width = CANVAS_W * dpr;
      canvas.height = CANVAS_H * dpr;
      canvas.style.width = `${CANVAS_W}px`;
      canvas.style.height = `${CANVAS_H}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = '#12100d';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Apply pan
    ctx.save();
    ctx.translate(pan.x, pan.y);

    for (let q = drawWindow.minQ; q <= drawWindow.maxQ; q++) {
      for (let r = drawWindow.minR; r <= drawWindow.maxR; r++) {
        const { cx, cy } = hexCenter(q, r, HEX_SIZE);
        const known = hexMap.get(`${q},${r}`);
        const state = known?.reveal_state ?? 'unrevealed';

        hexPath(ctx, cx, cy, HEX_SIZE - 1);

        if (state === 'unrevealed') {
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

        if (state === 'mapped') {
          // Small centered glyph indicating a local map is anchored here
          ctx.fillStyle = COLOR_MAPPED_STROKE;
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        if (hover && hover[0] === q && hover[1] === r) {
          hexPath(ctx, cx, cy, HEX_SIZE - 1);
          ctx.strokeStyle = COLOR_HOVER_STROKE;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }, [pan, hexMap, drawWindow, hover]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Redraw on window resize (for DPR changes on external monitor swaps)
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const screenToHex = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const worldX = sx - pan.x;
      const worldY = sy - pan.y;
      return pixelToHexUnbounded(worldX, worldY, HEX_SIZE);
    },
    [pan]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (mode === 'pan') {
        panDragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origX: pan.x,
          origY: pan.y,
        };
      }
    },
    [mode, pan]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (panDragRef.current) {
        setPan({
          x: panDragRef.current.origX + (e.clientX - panDragRef.current.startX),
          y: panDragRef.current.origY + (e.clientY - panDragRef.current.startY),
        });
        return;
      }
      const hex = screenToHex(e.clientX, e.clientY);
      if (!hex) {
        if (hover) setHover(null);
        return;
      }
      if (!hover || hover[0] !== hex[0] || hover[1] !== hex[1]) {
        setHover(hex);
      }
    },
    [screenToHex, hover]
  );

  const onMouseUp = useCallback(() => {
    panDragRef.current = null;
  }, []);

  const onMouseLeave = useCallback(() => {
    panDragRef.current = null;
    setHover(null);
  }, []);

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      const hex = screenToHex(e.clientX, e.clientY);
      if (!hex) return;
      const [q, r] = hex;
      const existing = hexMap.get(`${q},${r}`);

      // Mapped hexes navigate regardless of mode
      if (existing?.reveal_state === 'mapped' && existing.local_map_id) {
        router.push(`/dm/map-builder/${existing.local_map_id}`);
        return;
      }

      if (mode === 'reveal') {
        const nextState =
          existing?.reveal_state === 'revealed' ? 'unrevealed' : 'revealed';
        try {
          const res = await fetch('/api/world/hexes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q, r, reveal_state: nextState }),
          });
          if (!res.ok) {
            console.warn('reveal toggle failed', await res.text());
            return;
          }
          const updated: WorldHex = await res.json();
          setHexes((prev) => {
            const idx = prev.findIndex((h) => h.q === q && h.r === r);
            if (idx === -1) return [...prev, updated];
            const next = prev.slice();
            next[idx] = updated;
            return next;
          });
        } catch (err) {
          console.warn('reveal toggle error', err);
        }
      }
    },
    [mode, hexMap, screenToHex, router]
  );

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto" style={{ maxWidth: 1280, padding: '24px 16px' }}>
      <header className="flex items-baseline justify-between mb-4">
        <div>
          <h1 className="text-2xl font-serif text-[#c9a84c]">{world.name}</h1>
          <p className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7a4c] font-sans mt-1">
            World Map &middot; {hexes.length} hex{hexes.length === 1 ? '' : 'es'} touched
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </header>

      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        style={{
          display: 'block',
          width: CANVAS_W,
          height: CANVAS_H,
          maxWidth: '100%',
          border: '1px solid #2c241d',
          borderRadius: 2,
          cursor: mode === 'pan' ? (panDragRef.current ? 'grabbing' : 'grab') : 'crosshair',
        }}
      />

      <p className="text-[0.7rem] uppercase tracking-[0.15em] text-[#6a5a3c] font-sans mt-3">
        {mode === 'reveal'
          ? 'Click a hex to toggle reveal. Mapped hexes open their local map.'
          : mode === 'pan'
          ? 'Drag to pan. Click a mapped hex to open its local map.'
          : 'Click a mapped hex to open its local map.'}
      </p>
    </div>
  );
}

// ── Mode toggle (segmented button group, no dropdowns) ─────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const options: { key: Mode; label: string }[] = [
    { key: 'reveal', label: 'Reveal' },
    { key: 'pan', label: 'Pan' },
    { key: 'navigate', label: 'Navigate' },
  ];
  return (
    <div className="inline-flex" style={{ gap: 0 }}>
      {options.map((opt, i) => {
        const active = opt.key === mode;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="font-sans text-[0.7rem] uppercase tracking-[0.15em]"
            style={{
              padding: '6px 14px',
              background: active ? '#c9a84c' : 'transparent',
              color: active ? '#1a1614' : '#8a7a4c',
              border: '1px solid #5a4632',
              borderLeftWidth: i === 0 ? 1 : 0,
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
