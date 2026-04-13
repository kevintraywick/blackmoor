'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { hexCenter, hexPath } from '@/lib/hex-math';
import type { WorldHex, WorldMap, WorldEntity, WorldEntityKind } from '@/lib/world';
import { formatGameTime } from '@/lib/game-clock-format';

interface ClockState {
  game_time_seconds: number;
  clock_paused: boolean;
  clock_last_advanced_at: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const HEX_SIZE = 47;        // screen px, flat-top radius
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

type Mode = 'reveal' | 'pan' | 'navigate' | 'place-entity' | 'set-party' | 'paint';

// Terrain types — Baumgart hand-painted hex tiles (256×384, flat-top)
const TERRAIN_PALETTE = [
  { type: 'hexPlains00', label: 'Plains' },
  { type: 'hexForestBroadleaf00', label: 'Forest' },
  { type: 'hexWoodlands00', label: 'Woodlands' },
  { type: 'hexHills00', label: 'Hills' },
  { type: 'hexHighlands00', label: 'Highlands' },
  { type: 'hexMountain00', label: 'Mountain' },
  { type: 'hexMarsh00', label: 'Marsh' },
  { type: 'hexScrublands00', label: 'Scrublands' },
  { type: 'hexDirt00', label: 'Dirt' },
  { type: 'hexDesertDunes00', label: 'Desert' },
  { type: 'hexOcean00', label: 'Ocean' },
  { type: 'hexVoid00', label: 'Void' },
  { type: 'hexBase00', label: 'Base' },
  { type: null, label: 'Erase' },
] as const;

const ENTITY_KINDS: { kind: WorldEntityKind; label: string; glyph: string; color: string }[] = [
  { kind: 'storm',       label: 'Storm',       glyph: '⛈', color: '#9ec5e8' },
  { kind: 'horde',       label: 'Horde',       glyph: '☠', color: '#c07a8a' },
  { kind: 'caravan',     label: 'Caravan',     glyph: '⛺', color: '#c9a84c' },
  { kind: 'army',        label: 'Army',        glyph: '⚔', color: '#d04a3a' },
  { kind: 'other_party', label: 'Other Party', glyph: '◉', color: '#7ac28a' },
];

interface Props {
  world: WorldMap;
  initialHexes: WorldHex[];
  initialEntities: WorldEntity[];
  initialClock: ClockState;
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

export default function WorldMapClient({ world, initialHexes, initialEntities, initialClock }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hexes, setHexes] = useState<WorldHex[]>(initialHexes);
  const [entities, setEntities] = useState<WorldEntity[]>(initialEntities);
  const [clock, setClock] = useState<ClockState>(initialClock);
  const [mode, setMode] = useState<Mode>('reveal');
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [placeKind, setPlaceKind] = useState<WorldEntityKind>('caravan');
  const [partyHex, setPartyHex] = useState<[number, number] | null>(null);
  const [paintTerrain, setPaintTerrain] = useState<string | null>('hexPlains00');
  const spriteCache = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    fetch('/api/party/position')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.party_q != null && data?.party_r != null) {
          setPartyHex([data.party_q, data.party_r]);
        }
      })
      .catch(() => {});
  }, []);
  const [advanceErr, setAdvanceErr] = useState<string | null>(null);
  const [spritesReady, setSpritesReady] = useState(false);

  // Pre-load all terrain sprite images
  useEffect(() => {
    const toLoad: string[] = [];
    for (const t of TERRAIN_PALETTE) {
      if (!t.type) continue;
      toLoad.push(`/images/hex-tiles/baumgart/${t.type}.png`);
    }
    let loaded = 0;
    for (const src of toLoad) {
      if (spriteCache.current.has(src)) { loaded++; continue; }
      const img = new Image();
      img.onload = () => {
        spriteCache.current.set(src, img);
        loaded++;
        if (loaded >= toLoad.length) setSpritesReady(true);
      };
      img.onerror = () => { loaded++; if (loaded >= toLoad.length) setSpritesReady(true); };
      img.src = src;
    }
    if (loaded >= toLoad.length) setSpritesReady(true);
  }, []);

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

  const getSpritePath = useCallback((terrainType: string) => {
    const entry = TERRAIN_PALETTE.find(t => t.type === terrainType);
    if (!entry) return null;
    return `/images/hex-tiles/baumgart/${terrainType}.png`;
  }, []);

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

        hexPath(ctx, cx, cy, HEX_SIZE);

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

        // Draw terrain sprite if the hex has one
        if (known?.terrain_type) {
          const spritePath = getSpritePath(known.terrain_type);
          const img = spritePath ? spriteCache.current.get(spritePath) : null;
          if (img) {
            // Baumgart tiles are 256×384 (flat-top hex). The hex face fills
            // the tile width; extra height is elevation (mountains, trees).
            // Scale so tile width matches hex width (2 × HEX_SIZE).
            const spriteW = HEX_SIZE * 2;
            const spriteH = spriteW * (img.naturalHeight / img.naturalWidth);
            // Hex bottom aligns with tile bottom; overshoot goes upward.
            const hexH = HEX_SIZE * Math.sqrt(3);
            const drawY = cy - hexH / 2 - (spriteH - hexH);
            ctx.save();
            hexPath(ctx, cx, cy, HEX_SIZE);
            ctx.clip();
            ctx.drawImage(img, cx - spriteW / 2, drawY, spriteW, spriteH);
            ctx.restore();
            hexPath(ctx, cx, cy, HEX_SIZE);
            ctx.strokeStyle = COLOR_REVEALED_STROKE;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }

        if (state === 'mapped') {
          // Small centered glyph indicating a local map is anchored here
          ctx.fillStyle = COLOR_MAPPED_STROKE;
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        if (hover && hover[0] === q && hover[1] === r) {
          hexPath(ctx, cx, cy, HEX_SIZE);
          ctx.strokeStyle = COLOR_HOVER_STROKE;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // Draw entities — small glyph on the hex they currently occupy
    for (const ent of entities) {
      const { cx, cy } = hexCenter(ent.current_q, ent.current_r, HEX_SIZE);
      const meta = ENTITY_KINDS.find((k) => k.kind === ent.kind);
      ctx.save();
      ctx.font = '20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = meta?.color ?? '#e8dcc4';
      ctx.fillText(meta?.glyph ?? '●', cx, cy);
      ctx.restore();
    }

    // Party position marker
    if (partyHex) {
      const { cx, cy } = hexCenter(partyHex[0], partyHex[1], HEX_SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201,168,76,0.35)';
      ctx.fill();
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#c9a84c';
      ctx.fillText('P', cx, cy + 0.5);
      ctx.restore();
    }

    ctx.restore();
  }, [pan, hexMap, drawWindow, hover, entities, partyHex, getSpritePath, spritesReady]);

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
      // Scale from rendered CSS size back to logical canvas size
      // (handles max-width: 100% shrinking the canvas)
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const sx = (clientX - rect.left) * scaleX;
      const sy = (clientY - rect.top) * scaleY;
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

      // Mapped hexes navigate regardless of mode. The map builder reads
      // ?build=<id> and auto-opens the build; ?returnToWorld=q,r renders
      // a "← World" breadcrumb that returns here centered on the same hex.
      if (existing?.reveal_state === 'mapped' && existing.local_map_id) {
        router.push(
          `/dm/map-builder?build=${existing.local_map_id}&returnToWorld=${q},${r}`
        );
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
      } else if (mode === 'place-entity') {
        try {
          const res = await fetch('/api/world/entities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: placeKind, q, r }),
          });
          if (!res.ok) {
            console.warn('place entity failed', await res.text());
            return;
          }
          const ent: WorldEntity = await res.json();
          setEntities((prev) => [...prev, ent]);
        } catch (err) {
          console.warn('place entity error', err);
        }
      } else if (mode === 'paint') {
        try {
          const res = await fetch('/api/world/terrain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q, r, terrain_type: paintTerrain, rotation: 0 }),
          });
          if (!res.ok) return;
          const updated: WorldHex = await res.json();
          setHexes((prev) => {
            const idx = prev.findIndex((h) => h.q === q && h.r === r);
            if (idx === -1) return [...prev, updated];
            const next = prev.slice();
            next[idx] = updated;
            return next;
          });
        } catch (err) {
          console.warn('paint terrain error', err);
        }
      } else if (mode === 'set-party') {
        if (partyHex && partyHex[0] === q && partyHex[1] === r) return;
        try {
          const res = await fetch('/api/party/position', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q, r }),
          });
          if (!res.ok) {
            console.warn('set party failed', await res.text());
            return;
          }
          setPartyHex([q, r]);
        } catch (err) {
          console.warn('set party error', err);
        }
      }
    },
    [mode, hexMap, screenToHex, router, placeKind, partyHex, paintTerrain]
  );

  // Advance the campaign clock by N seconds. World entities tick along
  // their waypoint paths inside the same DB transaction (lib/game-clock.ts).
  const advance = useCallback(async (seconds: number) => {
    setAdvanceErr(null);
    try {
      const res = await fetch('/api/clock/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAdvanceErr(data.error || 'Advance failed');
        return;
      }
      const data = await res.json();
      setClock(data.clock);
      // Refetch entities so positions reflect the tick fan-out
      const entRes = await fetch('/api/world/entities');
      if (entRes.ok) {
        const ents: WorldEntity[] = await entRes.json();
        setEntities(ents);
      }
    } catch {
      setAdvanceErr('Network error');
    }
  }, []);

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto" style={{ maxWidth: 1280, padding: '24px 16px' }}>
      <header className="flex items-baseline justify-between mb-4">
        <div>
          <h1 className="text-2xl font-serif text-[#c9a84c]">{world.name}</h1>
          <p className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7a4c] font-sans mt-1">
            World Map &middot; {hexes.length} hex{hexes.length === 1 ? '' : 'es'} touched &middot; {entities.length} entit{entities.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </header>

      {/* Game clock readout + advance controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 12,
          padding: '10px 14px',
          background: '#1a2118',
          border: '1px solid #4a7a5a',
          borderRadius: 2,
        }}
      >
        <div>
          <div className="font-serif text-[1rem] text-[#e8dcc4]">
            {formatGameTime(clock.game_time_seconds)}
          </div>
          <div
            className="text-[0.62rem] uppercase tracking-[0.18em] font-sans"
            style={{ color: clock.clock_paused ? '#c9a84c' : '#7ac28a' }}
          >
            {clock.clock_paused ? 'Clock Paused' : 'Clock Running'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <AdvanceButton label="+1h" onClick={() => advance(3600)} disabled={clock.clock_paused} />
          <AdvanceButton label="+8h" onClick={() => advance(8 * 3600)} disabled={clock.clock_paused} />
          <AdvanceButton label="+1d" onClick={() => advance(24 * 3600)} disabled={clock.clock_paused} />
        </div>
        {advanceErr && (
          <div className="text-[0.7rem] font-sans uppercase tracking-[0.15em]" style={{ color: '#c07a8a' }}>
            {advanceErr}
          </div>
        )}
      </div>

      {/* Entity kind picker — visible only in place-entity mode */}
      {mode === 'place-entity' && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 12,
            padding: '10px 14px',
            background: '#1a1614',
            border: '1px solid #5a4632',
            borderRadius: 2,
          }}
        >
          <span className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7a4c] font-sans self-center">
            Placing
          </span>
          {ENTITY_KINDS.map((k) => {
            const active = k.kind === placeKind;
            return (
              <button
                key={k.kind}
                type="button"
                onClick={() => setPlaceKind(k.kind)}
                className="font-sans text-[0.7rem] uppercase tracking-[0.15em]"
                style={{
                  padding: '6px 12px',
                  background: active ? `${k.color}22` : 'transparent',
                  color: active ? k.color : '#8a7a4c',
                  border: `1px solid ${active ? k.color : '#5a4632'}`,
                  cursor: 'pointer',
                }}
              >
                {k.glyph} {k.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Terrain palette — visible only in paint mode */}
      {mode === 'paint' && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 12,
            padding: '10px 14px',
            background: '#1a1614',
            border: '1px solid #5a4632',
            borderRadius: 2,
            alignItems: 'center',
          }}
        >
          <span className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7a4c] font-sans" style={{ marginRight: 4 }}>
            Terrain
          </span>
          {TERRAIN_PALETTE.map((t) => {
            const active = paintTerrain === t.type;
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => setPaintTerrain(t.type)}
                className="font-sans text-[0.65rem] uppercase tracking-[0.1em]"
                style={{
                  padding: '4px 8px',
                  background: active ? '#c9a84c22' : 'transparent',
                  color: active ? '#c9a84c' : '#8a7a4c',
                  border: `1px solid ${active ? '#c9a84c' : '#5a4632'}`,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

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
          : mode === 'paint'
          ? 'Select a terrain tile above, then click hexes to paint. Use R buttons for rotation.'
          : 'Click a mapped hex to open its local map.'}
      </p>
    </div>
  );
}

// ── Mode toggle (segmented button group, no dropdowns) ─────────────────────

function AdvanceButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-sans text-[0.7rem] uppercase tracking-[0.15em]"
      style={{
        padding: '6px 12px',
        background: disabled ? 'transparent' : '#c9a84c',
        color: disabled ? '#5a6a52' : '#1a1614',
        border: `1px solid ${disabled ? '#3a4036' : '#c9a84c'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const options: { key: Mode; label: string }[] = [
    { key: 'reveal', label: 'Reveal' },
    { key: 'pan', label: 'Pan' },
    { key: 'navigate', label: 'Navigate' },
    { key: 'place-entity', label: 'Place' },
    { key: 'set-party', label: 'Party' },
    { key: 'paint', label: 'Paint' },
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
