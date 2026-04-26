'use client';

import { useEffect, useRef, useState } from 'react';
import type { MapBuild } from '@/lib/types';

const GRID_COLS = 30;
const GRID_ROWS = 30;
const VIEWPORT_PX = 720;
const CELL_PX = VIEWPORT_PX / GRID_COLS;

interface Props {
  build: MapBuild;
  /** Closes the overlay. Drag-releases persist offsets in-place; only Done /
   *  Esc fires this so the DM can iterate freely. */
  onClose: () => void;
}

/**
 * Top-down placement view shown after a DM drops a map onto a globe hex.
 *
 * The map renders centered inside a 30×30 snap grid that represents the hex's
 * territory. Dragging snaps to grid squares with a click for each square
 * crossed; releasing settles the map into place and persists the offset.
 *
 * Sounds are synthesized via WebAudio (no asset to commit). Pitch is tuned to
 * read as a small wooden tick on each step plus a softer "settle" thud on
 * release — a satisfying physical confirmation rather than a UI beep.
 */
export default function MapPlacementOverlay({ build, onClose }: Props) {
  const [offsetCol, setOffsetCol] = useState(build.placement_offset_col ?? 0);
  const [offsetRow, setOffsetRow] = useState(build.placement_offset_row ?? 0);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    startCol: number;
    startRow: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTickRef = useRef<{ col: number; row: number }>({ col: offsetCol, row: offsetRow });

  function ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }

  function playTick() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.04);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  function playSettle() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.18);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.28, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  // Image sizing — fit to ~60% of viewport so there's room to drag without
  // clipping the hex bounds in either axis.
  const naturalW = build.image_width_px ?? 0;
  const naturalH = build.image_height_px ?? 0;
  const imageScale = (() => {
    if (!naturalW || !naturalH) return 1;
    const target = VIEWPORT_PX * 0.6;
    return target / Math.max(naturalW, naturalH);
  })();
  const imgW = naturalW * imageScale;
  const imgH = naturalH * imageScale;

  function handlePointerDown(e: React.PointerEvent) {
    if (saving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ startX: e.clientX, startY: e.clientY, startCol: offsetCol, startRow: offsetRow });
    lastTickRef.current = { col: offsetCol, row: offsetRow };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const newCol = drag.startCol + Math.round(dx / CELL_PX);
    const newRow = drag.startRow + Math.round(dy / CELL_PX);

    // Clamp so the image's center stays inside the grid.
    const halfCols = GRID_COLS / 2;
    const halfRows = GRID_ROWS / 2;
    const clampedCol = Math.max(-halfCols + 1, Math.min(halfCols - 1, newCol));
    const clampedRow = Math.max(-halfRows + 1, Math.min(halfRows - 1, newRow));

    if (clampedCol !== offsetCol || clampedRow !== offsetRow) {
      const stepped =
        Math.abs(clampedCol - lastTickRef.current.col) +
        Math.abs(clampedRow - lastTickRef.current.row);
      if (stepped > 0) {
        playTick();
        lastTickRef.current = { col: clampedCol, row: clampedRow };
      }
      setOffsetCol(clampedCol);
      setOffsetRow(clampedRow);
    }
  }

  async function handlePointerUp() {
    if (!drag) return;
    setDrag(null);
    playSettle();
    setSaving(true);
    try {
      // Anchor cell isn't changing — we only update the offset within it.
      // The /globe-placement route accepts a cell + offsets; we re-send the
      // current cell from the build so the route can validate.
      // h3_cell on the build is a Postgres BIGINT — convert back to hex string.
      const cellHex = build.h3_cell
        ? BigInt(build.h3_cell).toString(16).padStart(15, '0')
        : null;
      if (cellHex) {
        await fetch(`/api/map-builder/${build.id}/globe-placement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cell: cellHex, offset_col: offsetCol, offset_row: offsetRow }),
        });
      }
    } finally {
      setSaving(false);
    }
  }

  // Esc closes (offset is already persisted on each drag-release).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.78)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          color: '#d0e0ff',
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          letterSpacing: '0.08em',
          textAlign: 'center',
        }}
      >
        Drag the map to position it on the hex · release to place
      </div>

      <div
        style={{
          width: VIEWPORT_PX,
          height: VIEWPORT_PX,
          position: 'relative',
          background: '#1a1a1f',
          border: '1px solid #2a3a5e',
          borderRadius: 4,
          overflow: 'hidden',
          touchAction: 'none',
          cursor: drag ? 'grabbing' : 'grab',
        }}
      >
        {/* Snap grid */}
        <svg
          width={VIEWPORT_PX}
          height={VIEWPORT_PX}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <defs>
            <pattern id="snap-grid" width={CELL_PX} height={CELL_PX} patternUnits="userSpaceOnUse">
              <path
                d={`M ${CELL_PX} 0 L 0 0 0 ${CELL_PX}`}
                fill="none"
                stroke="#2c3550"
                strokeWidth={1}
              />
            </pattern>
          </defs>
          <rect width={VIEWPORT_PX} height={VIEWPORT_PX} fill="url(#snap-grid)" />
          {/* Center cross — visible reference for "centered" */}
          <line
            x1={VIEWPORT_PX / 2 - 8}
            x2={VIEWPORT_PX / 2 + 8}
            y1={VIEWPORT_PX / 2}
            y2={VIEWPORT_PX / 2}
            stroke="#3a4a70"
          />
          <line
            x1={VIEWPORT_PX / 2}
            x2={VIEWPORT_PX / 2}
            y1={VIEWPORT_PX / 2 - 8}
            y2={VIEWPORT_PX / 2 + 8}
            stroke="#3a4a70"
          />
        </svg>

        {/* Draggable image */}
        {build.image_path ? (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'absolute',
              left: VIEWPORT_PX / 2 + offsetCol * CELL_PX - imgW / 2,
              top: VIEWPORT_PX / 2 + offsetRow * CELL_PX - imgH / 2,
              width: imgW || 240,
              height: imgH || 240,
              border: '2px solid #c9a84c',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.6)',
              background: '#222',
              touchAction: 'none',
              transition: drag ? 'none' : 'left 0.12s ease-out, top 0.12s ease-out',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/map-builder/${build.id}/image`}
              alt={build.name}
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7a98',
              fontSize: 13,
            }}
          >
            No image on this build
          </div>
        )}
      </div>

      <div
        style={{
          color: '#8aa0c8',
          fontSize: 11,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        offset: ({offsetCol}, {offsetRow})
        {saving && '  ·  saving…'}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid #3e5683',
            color: '#8aa0c8',
            padding: '8px 16px',
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontFamily: 'ui-sans-serif, system-ui',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
