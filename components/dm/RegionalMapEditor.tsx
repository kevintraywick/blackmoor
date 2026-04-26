'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { RegionalMapAnchor } from '@/lib/types';
import { buildRegionalProjection } from '@/lib/regional-anchor';

interface BuildRow {
  id: string;
  name: string;
  image_path: string | null;
  image_width_px: number | null;
  image_height_px: number | null;
  mirror_horizontal: boolean;
}

interface Props {
  build: BuildRow;
  initialAnchors: RegionalMapAnchor[];
}

const ANCHOR_COLORS = ['#7ac2ff', '#ffcd5a'] as const;

/**
 * Click-to-set editor for a regional map's two anchors.
 *
 * Renders the source image, draws each anchor's current px position as a
 * colored ring, and lets the DM enter "set anchor" mode by clicking an
 * anchor in the side panel — the next click on the image captures (px, py)
 * and POSTs the update. A small read-out shows the projection's predicted
 * lat/lng for any cursor position once both anchors are set.
 */
export default function RegionalMapEditor({ build, initialAnchors }: Props) {
  const [anchors, setAnchors] = useState(initialAnchors);
  const [armedAnchorId, setArmedAnchorId] = useState<string | null>(null);
  const [hoverLatLng, setHoverLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [mirror, setMirror] = useState(build.mirror_horizontal);
  const [savingMirror, setSavingMirror] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Image natural dims (use the cached values from the build row when present;
  // fall back to the actual <img> after load).
  const [naturalDims, setNaturalDims] = useState({
    width: build.image_width_px ?? 0,
    height: build.image_height_px ?? 0,
  });

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setNaturalDims({ width: img.naturalWidth, height: img.naturalHeight });
    }
  }

  // Two anchors with px set + mirror flag → projection.
  const projection = useMemo(() => {
    const set = anchors.filter(
      (a): a is RegionalMapAnchor & { image_px_x: number; image_px_y: number } =>
        a.image_px_x != null && a.image_px_y != null,
    );
    if (set.length < 2 || !naturalDims.width) return null;
    const [a, b] = set;
    return buildRegionalProjection({
      anchors: [
        { imagePxX: a.image_px_x, imagePxY: a.image_px_y, realLat: a.real_lat, realLng: a.real_lng },
        { imagePxX: b.image_px_x, imagePxY: b.image_px_y, realLat: b.real_lat, realLng: b.real_lng },
      ],
      imageWidth: naturalDims.width,
      mirrorHorizontal: mirror,
    });
  }, [anchors, naturalDims.width, mirror]);

  function clientToImagePx(e: React.MouseEvent<HTMLDivElement>): { px: number; py: number } | null {
    const img = imgRef.current;
    if (!img || !naturalDims.width || !naturalDims.height) return null;
    const rect = img.getBoundingClientRect();
    const xWithin = e.clientX - rect.left;
    const yWithin = e.clientY - rect.top;
    if (xWithin < 0 || yWithin < 0 || xWithin > rect.width || yWithin > rect.height) return null;
    return {
      px: (xWithin / rect.width) * naturalDims.width,
      py: (yWithin / rect.height) * naturalDims.height,
    };
  }

  async function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!armedAnchorId) return;
    const hit = clientToImagePx(e);
    if (!hit) return;
    const target = anchors.find(a => a.id === armedAnchorId);
    if (!target) return;
    const px = Math.round(hit.px);
    const py = Math.round(hit.py);
    setAnchors(prev => prev.map(a => (a.id === armedAnchorId ? { ...a, image_px_x: px, image_px_y: py } : a)));
    setArmedAnchorId(null);
    try {
      await fetch(`/api/regional-maps/${build.id}/anchors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_name: target.feature_name, image_px_x: px, image_px_y: py }),
      });
    } catch (err) {
      console.error('save anchor', err);
    }
  }

  function handleImageMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!projection) return setHoverLatLng(null);
    const hit = clientToImagePx(e);
    if (!hit) return setHoverLatLng(null);
    setHoverLatLng(projection.toLatLng(hit.px, hit.py));
  }

  async function toggleMirror() {
    const next = !mirror;
    setMirror(next);
    setSavingMirror(true);
    try {
      await fetch(`/api/regional-maps/${build.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mirror_horizontal: next }),
      });
    } finally {
      setSavingMirror(false);
    }
  }

  // Esc cancels armed mode.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setArmedAnchorId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 120px)', background: '#0a0f20' }}>
      {/* Left panel — anchor list + controls */}
      <aside
        className="flex flex-col gap-4 text-xs font-sans"
        style={{ width: 280, padding: 20, borderRight: '1px solid #2a3a5e', color: '#cfe6ff' }}
      >
        <Link
          href="/dm/regional-maps"
          className="text-[0.7rem] uppercase tracking-[0.15em]"
          style={{ color: '#7ac2ff' }}
        >
          ← Regional Maps
        </Link>

        <div>
          <div className="text-[0.65rem] uppercase tracking-[0.15em]" style={{ opacity: 0.7 }}>
            Map
          </div>
          <div className="font-serif" style={{ fontSize: 16, color: '#ffffff', marginTop: 2 }}>
            {build.name}
          </div>
          <div style={{ opacity: 0.55, marginTop: 4, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {naturalDims.width || '—'} × {naturalDims.height || '—'} px
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMirror}
          disabled={savingMirror}
          className="text-[0.7rem] uppercase tracking-[0.15em] font-sans"
          style={{
            background: mirror ? 'rgba(122,194,255,0.18)' : 'transparent',
            border: `1px solid ${mirror ? '#7ac2ff' : '#3e5683'}`,
            color: mirror ? '#cfe6ff' : '#7ac2ff',
            cursor: 'pointer',
            padding: '8px 10px',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Mirror horizontal</span>
          <span style={{
            display: 'inline-block',
            width: 10, height: 10, borderRadius: '50%',
            background: mirror ? '#7ac2ff' : 'transparent',
            border: `1.5px solid ${mirror ? '#7ac2ff' : '#6b7a98'}`,
          }} />
        </button>

        <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid #2a3a5e' }}>
          <div className="text-[0.65rem] uppercase tracking-[0.15em]" style={{ opacity: 0.7 }}>
            Anchors — {anchors.length}
          </div>
          {anchors.length === 0 && (
            <div className="font-serif italic" style={{ color: '#6b7a98' }}>
              No anchors defined for this map.
            </div>
          )}
          {anchors.map((a, i) => {
            const armed = armedAnchorId === a.id;
            const color = ANCHOR_COLORS[i] ?? '#cfe6ff';
            const isSet = a.image_px_x != null && a.image_px_y != null;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setArmedAnchorId(armed ? null : a.id)}
                className="text-[0.75rem]"
                style={{
                  background: armed ? `${color}24` : 'transparent',
                  border: `1px solid ${armed ? color : '#2a3a5e'}`,
                  color: '#cfe6ff',
                  cursor: 'pointer',
                  padding: '8px 10px',
                  borderRadius: 2,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  <strong style={{ color: '#ffffff' }}>{a.feature_name}</strong>
                </div>
                <div style={{ opacity: 0.7, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  real: {a.real_lat.toFixed(4)}, {a.real_lng.toFixed(4)}
                </div>
                <div style={{ opacity: 0.7, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  px: {isSet ? `${a.image_px_x}, ${a.image_px_y}` : '— click to set —'}
                </div>
                {armed && (
                  <div style={{ color, fontFamily: 'ui-sans-serif, system-ui', fontSize: 10, marginTop: 2 }}>
                    Click on the image to set this anchor (Esc to cancel)
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {projection && hoverLatLng && (
          <div className="flex flex-col gap-1 pt-2" style={{ borderTop: '1px solid #2a3a5e' }}>
            <div className="text-[0.65rem] uppercase tracking-[0.15em]" style={{ opacity: 0.7 }}>
              Cursor
            </div>
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#ffffff' }}>
              {hoverLatLng.lat.toFixed(4)}, {hoverLatLng.lng.toFixed(4)}
            </div>
          </div>
        )}

        {!projection && (
          <div
            className="font-serif italic"
            style={{ color: '#7a8aad', fontSize: 12, paddingTop: 8, borderTop: '1px solid #2a3a5e' }}
          >
            Set both anchor pixel positions to enable the px → lat/lng projection.
          </div>
        )}
      </aside>

      {/* Image canvas */}
      <div
        style={{ flex: 1, position: 'relative', overflow: 'auto', cursor: armedAnchorId ? 'crosshair' : 'default' }}
        onClick={handleImageClick}
        onMouseMove={handleImageMove}
        onMouseLeave={() => setHoverLatLng(null)}
      >
        {build.image_path ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={`/api/map-builder/${build.id}/image`}
              alt={build.name}
              draggable={false}
              onLoad={handleImgLoad}
              style={{
                display: 'block',
                maxWidth: 'none',
                userSelect: 'none',
              }}
            />
            {/* Anchor overlays */}
            {naturalDims.width > 0 && imgRef.current && (
              <svg
                width={imgRef.current.clientWidth}
                height={imgRef.current.clientHeight}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                viewBox={`0 0 ${naturalDims.width} ${naturalDims.height}`}
                preserveAspectRatio="none"
              >
                {anchors.map((a, i) => {
                  if (a.image_px_x == null || a.image_px_y == null) return null;
                  const color = ANCHOR_COLORS[i] ?? '#cfe6ff';
                  return (
                    <g key={a.id}>
                      <circle
                        cx={a.image_px_x}
                        cy={a.image_px_y}
                        r={Math.max(8, naturalDims.width / 200)}
                        fill="none"
                        stroke={color}
                        strokeWidth={Math.max(2, naturalDims.width / 1000)}
                      />
                      <circle cx={a.image_px_x} cy={a.image_px_y} r={Math.max(2, naturalDims.width / 800)} fill={color} />
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        ) : (
          <div style={{ padding: 40, color: '#6b7a98', fontFamily: 'ui-sans-serif, system-ui' }}>
            No image uploaded for this regional map.
          </div>
        )}
      </div>
    </div>
  );
}
