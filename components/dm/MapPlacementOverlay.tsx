'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapBuild } from '@/lib/types';
import { hexSvgPath, projectHex } from '@/lib/hex-projection';
import { h3AnchorFitCheckByCell } from '@/lib/map-scale';
import ScaleBar from '@/components/ScaleBar';

const FT_PER_KM = 3280.84;
const VIEWPORT_PX = 720;
const VIEWPORT_RADIUS_PX = (VIEWPORT_PX / 2) * 0.92; // 8% inset for breathing room
const HEX_STROKE = '#ffffff';
const HEX_FILL = 'rgba(60, 130, 200, 0.10)'; // soft blue wash, vivid register

interface Props {
  build: MapBuild;
  /** Closes the overlay. Drag-releases persist offsets in-place; only Done /
   *  Esc fires this so the DM can iterate freely. */
  onClose: () => void;
}

/**
 * Hex-shaped placement view — opens after a DM drops a map onto a globe hex.
 *
 * The canvas is the **actual H3 hex polygon** projected to a local 2D plane
 * centered on its centroid (great-circle bearing × distance from center). For
 * res-4 cells that's a near-regular hexagon ≈ 45 km vertex-to-vertex. The
 * dropped image renders inside the hex at its **true km extent** (derived
 * from `cell_size_px + scale_value_ft + image dimensions` when available, or
 * a default fraction of the hex when not). Drag to position; scroll/pinch to
 * scale; ScaleBar in the corner shows km-per-pixel; live fit badge classifies
 * the result.
 *
 * Replaces the legacy 30×30 snap grid. The 30×30 was decorative — it mapped
 * to neither km nor ft, so a 5-ft battle map and a 6-mi region looked
 * visually identical at 720×720. The hex view is honest geometry.
 */
export default function MapPlacementOverlay({ build, onClose }: Props) {
  // The hex projection — pure function of build.h3_cell.
  const projection = useMemo(() => {
    if (!build.h3_cell) return null;
    const cellHex = BigInt(build.h3_cell).toString(16).padStart(15, '0');
    return projectHex(cellHex);
  }, [build.h3_cell]);

  const pxPerKm = projection ? VIEWPORT_RADIUS_PX / projection.outerRadiusKm : 0;
  const kmPerPx = pxPerKm > 0 ? 1 / pxPerKm : 0;

  // Image native km extent — derived from scale metadata. Falls back to a
  // sensible default (~30% of the hex's radius) so blank maps still appear.
  const nativeImageKm = useMemo(() => {
    if (!projection) return null;
    const w = build.image_width_px ?? 0;
    const h = build.image_height_px ?? 0;
    const cellSizePx = build.cell_size_px ?? 0;
    const scaleValueFt = build.scale_value_ft ?? 0;
    if (w > 0 && h > 0 && cellSizePx > 0 && scaleValueFt > 0) {
      const widthKm = (w / cellSizePx) * scaleValueFt / FT_PER_KM;
      const heightKm = (h / cellSizePx) * scaleValueFt / FT_PER_KM;
      return { widthKm, heightKm, derived: true as const };
    }
    if (w > 0 && h > 0) {
      const aspect = w / h;
      const widthKm = projection.outerRadiusKm * 0.6 * Math.min(1, aspect);
      const heightKm = widthKm / aspect;
      return { widthKm, heightKm, derived: false as const };
    }
    return null;
  }, [build.image_width_px, build.image_height_px, build.cell_size_px, build.scale_value_ft, projection]);

  // Live placement state.
  const [offsetKm, setOffsetKm] = useState({
    x: build.placement_offset_km_x ?? 0,
    y: build.placement_offset_km_y ?? 0,
  });
  const [scale, setScale] = useState(build.placement_scale ?? 1);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    startKmX: number;
    startKmY: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

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

  function playSettle() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, t);
    osc.frequency.exponentialRampToValueAtTime(360, t + 0.18);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  // Pixel sizes derived from km × pxPerKm × current scale.
  const imgScreenWidth = nativeImageKm ? nativeImageKm.widthKm * scale * pxPerKm : 0;
  const imgScreenHeight = nativeImageKm ? nativeImageKm.heightKm * scale * pxPerKm : 0;
  const imgScreenX = VIEWPORT_PX / 2 + offsetKm.x * pxPerKm - imgScreenWidth / 2;
  const imgScreenY = VIEWPORT_PX / 2 - offsetKm.y * pxPerKm - imgScreenHeight / 2;

  function handlePointerDown(e: React.PointerEvent) {
    if (saving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ startX: e.clientX, startY: e.clientY, startKmX: offsetKm.x, startKmY: offsetKm.y });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag || pxPerKm === 0) return;
    const dxPx = e.clientX - drag.startX;
    const dyPx = e.clientY - drag.startY;
    const dxKm = dxPx / pxPerKm;
    const dyKm = -dyPx / pxPerKm; // screen Y is down; km Y is north
    setOffsetKm({ x: drag.startKmX + dxKm, y: drag.startKmY + dyKm });
  }

  async function handlePointerUp() {
    if (!drag) return;
    setDrag(null);
    playSettle();
    await persist();
  }

  function handleWheel(e: React.WheelEvent) {
    if (saving || !nativeImageKm) return;
    // Trackpad-friendly: smaller deltaY → small scale change.
    const factor = Math.exp(-e.deltaY * 0.0015);
    setScale(prev => Math.max(0.05, Math.min(40, prev * factor)));
  }

  // Debounced persist on scale changes — fires 250 ms after the last wheel event.
  const scaleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (scaleSaveTimer.current) clearTimeout(scaleSaveTimer.current);
    scaleSaveTimer.current = setTimeout(() => {
      void persist();
    }, 250);
    return () => {
      if (scaleSaveTimer.current) clearTimeout(scaleSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  async function persist() {
    if (!build.h3_cell) return;
    setSaving(true);
    try {
      const cellHex = BigInt(build.h3_cell).toString(16).padStart(15, '0');
      await fetch(`/api/map-builder/${build.id}/globe-placement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cell: cellHex,
          offset_km_x: offsetKm.x,
          offset_km_y: offsetKm.y,
          scale,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  // Live fit check — uses the *scaled* image's km width as if the DM had
  // chosen scale_value_ft accordingly. We feed the synthetic widths through
  // h3AnchorFitCheckByCell with cellSizePx=imageWidthPx so it computes
  // widthKm directly from a 1:1 ratio — easier than reverse-engineering ft.
  const fit = useMemo(() => {
    if (!projection || !nativeImageKm) return null;
    const widthKm = nativeImageKm.widthKm * scale;
    const heightKm = nativeImageKm.heightKm * scale;
    // Synthesize cell_size_px so widthKm passes through unchanged.
    return h3AnchorFitCheckByCell({
      imageNaturalWidth: widthKm,
      imageNaturalHeight: heightKm,
      cellSizePx: 1,
      scaleValueFt: FT_PER_KM,
      anchorCell: build.h3_cell,
    });
  }, [projection, nativeImageKm, scale, build.h3_cell]);

  // Esc closes (offsets/scale already persisted on each release / wheel).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!projection) {
    return (
      <div style={overlayStyle}>
        <div style={{ color: '#cfe6ff' }}>This build isn&apos;t anchored to a hex yet.</div>
        <button type="button" onClick={onClose} style={doneButtonStyle}>Done</button>
      </div>
    );
  }

  const hexD = hexSvgPath(projection, pxPerKm, VIEWPORT_PX / 2, VIEWPORT_PX / 2);

  return (
    <div style={overlayStyle}>
      <div
        style={{
          color: '#cfe6ff',
          fontSize: 13,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          letterSpacing: '0.06em',
          textAlign: 'center',
        }}
      >
        Drag the map to position it inside the hex · scroll to scale · release to save
      </div>

      <div
        style={{
          width: VIEWPORT_PX,
          height: VIEWPORT_PX,
          position: 'relative',
          background: 'linear-gradient(180deg, #0c1428 0%, #0a1020 100%)',
          border: '1px solid #2a3a5e',
          borderRadius: 4,
          overflow: 'hidden',
          touchAction: 'none',
          cursor: drag ? 'grabbing' : 'grab',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* Hex outline + clip mask in one SVG */}
        <svg
          width={VIEWPORT_PX}
          height={VIEWPORT_PX}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <defs>
            <clipPath id="placement-hex-clip">
              <path d={hexD} />
            </clipPath>
          </defs>
          {/* Soft fill so the hex interior reads as a distinct region */}
          <path d={hexD} fill={HEX_FILL} stroke="none" />
        </svg>

        {/* Image — clipped to hex via CSS */}
        {build.image_path && nativeImageKm && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/map-builder/${build.id}/image`}
            alt={build.name}
            draggable={false}
            style={{
              position: 'absolute',
              left: imgScreenX,
              top: imgScreenY,
              width: imgScreenWidth,
              height: imgScreenHeight,
              clipPath: 'url(#placement-hex-clip)',
              userSelect: 'none',
              pointerEvents: 'none',
              boxShadow: drag ? '0 6px 24px rgba(0,0,0,0.55)' : '0 3px 12px rgba(0,0,0,0.4)',
              transition: drag ? 'none' : 'left 0.12s ease-out, top 0.12s ease-out',
            }}
          />
        )}

        {/* Hex stroke on top so it sits over the image */}
        <svg
          width={VIEWPORT_PX}
          height={VIEWPORT_PX}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <path d={hexD} fill="none" stroke={HEX_STROKE} strokeWidth={2} opacity={0.95} />
          {/* Center dot for "centered" reference */}
          <circle
            cx={VIEWPORT_PX / 2}
            cy={VIEWPORT_PX / 2}
            r={2}
            fill="#ffffff"
            opacity={0.55}
          />
        </svg>

        {/* Scale bar — bottom-left, km mode */}
        {kmPerPx > 0 && (
          <div style={{ position: 'absolute', left: 14, bottom: 14, zIndex: 5 }}>
            <ScaleBar mode="globe" kmPerPx={kmPerPx} targetWidthPx={140} />
          </div>
        )}

        {/* Fit badge — top-right */}
        {fit && (
          <div
            style={{
              position: 'absolute',
              right: 14,
              top: 14,
              padding: '6px 10px',
              borderRadius: 3,
              border: '1px solid',
              borderColor:
                fit.severity === 'ok' ? 'rgba(122,194,138,0.7)' :
                fit.severity === 'warn' ? 'rgba(255,205,90,0.7)' :
                'rgba(220,90,90,0.7)',
              background:
                fit.severity === 'ok' ? 'rgba(46,90,60,0.55)' :
                fit.severity === 'warn' ? 'rgba(110,80,30,0.55)' :
                'rgba(110,40,40,0.55)',
              color: '#ffffff',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 11,
              letterSpacing: '0.04em',
              maxWidth: 280,
              lineHeight: 1.4,
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            {fit.message}
          </div>
        )}
      </div>

      <div
        style={{
          color: '#9fb3d8',
          fontSize: 11,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          display: 'flex',
          gap: 18,
        }}
      >
        <span>offset: {offsetKm.x.toFixed(2)} km E, {offsetKm.y.toFixed(2)} km N</span>
        <span>scale: {scale.toFixed(2)}×</span>
        {nativeImageKm && (
          <span>
            image: {(nativeImageKm.widthKm * scale).toFixed(2)} × {(nativeImageKm.heightKm * scale).toFixed(2)} km
            {!nativeImageKm.derived && ' (no scale metadata — estimated)'}
          </span>
        )}
        {saving && <span style={{ color: '#7ac2c0' }}>saving…</span>}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" onClick={onClose} style={doneButtonStyle}>Done</button>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'radial-gradient(circle at center, rgba(15,30,55,0.86), rgba(0,0,0,0.92))',
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
};

const doneButtonStyle: React.CSSProperties = {
  background: 'rgba(60,130,200,0.18)',
  border: '1px solid rgba(120,180,230,0.65)',
  color: '#e8f1ff',
  padding: '8px 18px',
  fontSize: 11,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  fontFamily: 'ui-sans-serif, system-ui',
  borderRadius: 2,
  cursor: 'pointer',
};
