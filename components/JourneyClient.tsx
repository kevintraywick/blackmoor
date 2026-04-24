'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Session } from '@/lib/types';

// Terrain color/style map for the tall boxes
const TERRAIN_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  woods:    { bg: 'rgba(30,50,70,0.35)',  border: 'rgba(60,100,140,0.3)', label: 'Woods' },
  rocky:    { bg: 'rgba(40,55,80,0.35)',  border: 'rgba(70,105,150,0.3)', label: 'Rocky' },
  dungeon:  { bg: 'rgba(25,35,55,0.45)',  border: 'rgba(50,75,110,0.3)',  label: 'Dungeon' },
  swamp:    { bg: 'rgba(35,55,65,0.35)',  border: 'rgba(65,105,120,0.3)', label: 'Swamp' },
  plains:   { bg: 'rgba(45,60,85,0.3)',   border: 'rgba(80,115,160,0.3)', label: 'Plains' },
  mountains:{ bg: 'rgba(35,45,65,0.4)',   border: 'rgba(70,90,130,0.3)',  label: 'Mountains' },
};

// Cycle through warm, saturated blue shades
const BOX_BLUES = [
  'rgba(70,120,180,0.22)',
  'rgba(90,140,195,0.18)',
  'rgba(55,105,170,0.25)',
  'rgba(80,130,190,0.20)',
  'rgba(60,115,175,0.23)',
  'rgba(95,145,200,0.17)',
];

interface Props {
  sessions: Session[];
  imageMap?: Record<string, string>;
  campaignBackground?: string;
  campaignAudioUrl?: string;
  /** Player view — hides DM-only affordances (drag-and-drop image uploads, upload errors). */
  readOnly?: boolean;
}

// Nav + banner heights on mobile — the fullscreen overlay anchors below these.
const MOBILE_NAV_H = 48;
const MOBILE_BANNER_H = 200;

export default function JourneyClient({ sessions, imageMap: initialImageMap = {}, campaignBackground = '', campaignAudioUrl = '', readOnly = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imageMap, setImageMap] = useState<Record<string, string>>(initialImageMap);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Mobile breakpoint detection — matches Tailwind `sm:` (640px). False during SSR,
  // updated on mount + resize.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Audio playback — one shared element so only one track plays at a time.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const toggleAudio = useCallback((url: string) => {
    if (!url) return;
    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      el.addEventListener('ended', () => setPlayingUrl(null));
      audioRef.current = el;
    }
    if (playingUrl === url && !el.paused) {
      el.pause();
      setPlayingUrl(null);
      return;
    }
    if (el.src !== url && !el.src.endsWith(url)) {
      el.src = url;
    }
    el.currentTime = el.currentTime || 0;
    el.play().then(() => setPlayingUrl(url)).catch(() => setPlayingUrl(null));
  }, [playingUrl]);
  const stopAudio = useCallback(() => {
    const el = audioRef.current;
    if (el && !el.paused) el.pause();
    setPlayingUrl(null);
  }, []);

  // Safari drops files on the window unless every level of dragover/drop
  // calls preventDefault. Block page-level navigation so in-page zones receive the drop.
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  // Start with no popup open — the page resets to closed on every visit.
  const [activeJournal, setActiveJournal] = useState<number | null>(null);
  const [showBackstory, setShowBackstory] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // When an overlay is open, close on any click outside the panel — including
  // the sticky nav bar above JourneyClient, which doesn't bubble into our
  // root onClick.
  useEffect(() => {
    if (!activeJournal && !showBackstory) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      setActiveJournal(null);
      setShowBackstory(false);
      const el = audioRef.current;
      if (el && !el.paused) el.pause();
      setPlayingUrl(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [activeJournal, showBackstory]);

  // Box dimensions — contiguous, no gaps
  // Desktop: horizontal row, 200×450 per box.
  // Mobile: vertical stack, full-width × 300 per box, with path x in percentage units
  // (SVG viewBox is 100 units wide so circle x of 25 / 75 reads as 25% / 75%).
  const PLACEHOLDER_PANES = 3; // empty panes for planning future sessions
  const boxW = isMobile ? 100 : 200;   // mobile: % units (viewBox scales to 100% width)
  const boxH = isMobile ? 300 : 450;
  const totalW = isMobile ? 100 : (sessions.length + PLACEHOLDER_PANES) * boxW;
  const totalH = isMobile ? (sessions.length + PLACEHOLDER_PANES) * boxH : boxH + 40;
  const circleR = 60; // radius of session circles (120px diameter) — same on both layouts

  // Generate path points — weave left/right on mobile, up/down on desktop.
  // Mobile x is in percentage units (0–100); desktop x is pixels.
  function pointAt(index: number) {
    if (isMobile) {
      return {
        x: index % 2 === 0 ? 30 : 70,
        y: index * boxH + boxH / 2,
      };
    }
    return {
      x: index * boxW + boxW / 2,
      y: index % 2 === 0 ? boxH * 0.65 : boxH * 0.3,
    };
  }
  const pathPoints = sessions.map((_, i) => pointAt(i));
  const placeholderPoints = Array.from({ length: PLACEHOLDER_PANES }, (_, p) =>
    pointAt(sessions.length + p)
  );
  // Dim path starts at the last real session and flows through the placeholders
  // so the weave reads as one continuous journey.
  const dimPathPoints = pathPoints.length > 0
    ? [pathPoints[pathPoints.length - 1], ...placeholderPoints]
    : placeholderPoints;

  // Build SVG path string with smooth curves
  function buildPathFrom(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }

  // Upload handler for drag-and-drop (session images)
  const handleDrop = useCallback(async (sessionNumber: number, slot: 'circle' | 'bg', file: File) => {
    if (readOnly) return;
    const formData = new FormData();
    formData.append('session_number', String(sessionNumber));
    formData.append('slot', slot);
    formData.append('image', file);

    setUploadError(null);
    try {
      const res = await fetch('/api/uploads/journey', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || `Upload failed (${res.status})`);
      } else if (data.path) {
        setImageMap(prev => ({ ...prev, [`s${sessionNumber}_${slot}`]: data.path + '?t=' + Date.now() }));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
    setDragTarget(null);
  }, [readOnly]);

  // Upload handler for named keys (e.g. campaign_bg)
  const handleKeyDrop = useCallback(async (key: string, file: File) => {
    if (readOnly) return;
    const formData = new FormData();
    formData.append('key', key);
    formData.append('image', file);

    setUploadError(null);
    try {
      const res = await fetch('/api/uploads/journey', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || `Upload failed (${res.status})`);
      } else if (data.path) {
        setImageMap(prev => ({ ...prev, [key]: data.path + '?t=' + Date.now() }));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
    setDragTarget(null);
  }, [readOnly]);

  const onDragOver = (e: React.DragEvent, key: string) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(key);
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(null);
  };

  const onDrop = (e: React.DragEvent, sessionNumber: number, slot: 'circle' | 'bg') => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleDrop(sessionNumber, slot, file);
    } else {
      setDragTarget(null);
    }
  };

  return (
    <div className="max-w-full mx-auto relative" onClick={() => { setActiveJournal(null); setShowBackstory(false); stopAudio(); }}>
      {!readOnly && uploadError && (
        <div
          role="alert"
          onClick={(e) => { e.stopPropagation(); setUploadError(null); }}
          style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
            background: '#3a1414', color: '#ffb4b4', border: '1px solid #8b1a1a',
            padding: '10px 16px', borderRadius: 4, fontFamily: 'var(--font-sans, sans-serif)',
            fontSize: '0.85rem', cursor: 'pointer', maxWidth: 480,
          }}
        >
          Upload failed: {uploadError} · click to dismiss
        </div>
      )}
      {/* Banner */}
      <div className="relative w-full h-[200px] overflow-hidden" style={{ display: 'flex', alignItems: 'center' }}>
        <Image
          src="/images/journey/journey_splash.png"
          alt="Journey"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Campaign background circle — drop zone */}
        {(() => {
          const key = 'campaign_bg';
          const img = imageMap[key];
          const isDragOver = dragTarget === key;
          return (
            <div
              className="absolute z-10 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                ...(isMobile
                  ? { left: '50%', transform: isDragOver ? 'translateX(-50%) scale(1.1)' : 'translateX(-50%)' }
                  : { left: 100 - circleR, transform: isDragOver ? 'scale(1.1)' : undefined }),
                width: circleR * 2,
                height: circleR * 2,
                border: isDragOver ? '3px solid #4a7a5a' : '3px solid #000000',
                background: 'rgba(200,200,220,0.4)',
                transition: 'border 0.15s, transform 0.15s',
                cursor: campaignBackground ? 'pointer' : 'default',
              }}
              onClick={(e) => { e.stopPropagation(); if (campaignBackground) { setShowBackstory(prev => !prev); setActiveJournal(null); } }}
              onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(key); }}
              onDragLeave={readOnly ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(null); }}
              onDrop={readOnly ? undefined : (e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                  handleKeyDrop(key, file);
                } else {
                  setDragTarget(null);
                }
              }}
            >
              <img
                src={img || '/images/campaign/campaign_bg.png'}
                alt="Campaign"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 75%', opacity: 0.9 }}
              />
              <div className="absolute z-10 flex flex-col items-center select-none" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.85)', lineHeight: 1.0 }}>
                <span className="font-serif italic text-white tracking-[0.01em]" style={{ fontSize: '1.6rem' }}>Our Story</span>
                <span className="font-serif italic text-white tracking-[0.01em]" style={{ fontSize: '1.6rem' }}>So Far…</span>
              </div>
            </div>
          );
        })()}

        <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      </div>

      {/* Text overlay — anchored to circle on desktop; fullscreen on mobile */}
      {(() => {
        let overlayText: string | null = null;
        let overlayTitle: string | null = null;
        let overlayAudio: string = '';
        let anchorX = 0;
        let anchorY = 0;

        if (showBackstory && campaignBackground) {
          overlayText = campaignBackground;
          overlayTitle = 'Our Story So Far…';
          overlayAudio = campaignAudioUrl;
          // Backstory circle is in the banner at (boxW/2, circleR) on desktop
          anchorX = (isMobile ? 0 : boxW / 2) + circleR;
          anchorY = MOBILE_BANNER_H; // bottom of the banner
        } else if (activeJournal !== null) {
          const idx = sessions.findIndex(s => s.number === activeJournal);
          const s = idx >= 0 ? sessions[idx] : null;
          if (s?.journal_public && idx >= 0) {
            overlayText = s.journal_public;
            overlayTitle = s.title || `Session ${s.number}`;
            overlayAudio = s.audio_url || '';
            const pt = pathPoints[idx];
            anchorX = pt.x + circleR * 0.7;
            anchorY = MOBILE_BANNER_H + pt.y + circleR * 0.7;
          }
        }
        if (!overlayText) return null;
        const isBackstory = showBackstory;
        const isPlaying = !!overlayAudio && playingUrl === overlayAudio;

        // Sessions available in the mobile top-nav — backstory first, then every
        // session with public journal text. Placeholders skipped (no content yet).
        const navEntries: Array<
          { key: string; label: string; active: boolean; onClick: () => void; imageSrc?: string }
        > = [];
        if (campaignBackground) {
          navEntries.push({
            key: 'ossf',
            label: '☾',
            active: isBackstory,
            onClick: () => { setShowBackstory(true); setActiveJournal(null); stopAudio(); },
            imageSrc: imageMap['campaign_bg'] || '/images/campaign/campaign_bg.png',
          });
        }
        sessions.forEach((s) => {
          if (!s.journal_public) return;
          navEntries.push({
            key: `s${s.number}`,
            label: String(s.number),
            active: !isBackstory && activeJournal === s.number,
            onClick: () => { setActiveJournal(s.number); setShowBackstory(false); stopAudio(); },
            imageSrc: imageMap[`s${s.number}_circle`],
          });
        });

        // Shared inner panel — nav row (mobile) + title + optional speaker + text + (X) close
        const innerPanel = (
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#f2ead9',
              borderRadius: 8,
              padding: isMobile ? '12px 20px 20px 20px' : '20px 28px 24px 28px',
              pointerEvents: 'auto',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              overflow: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              ...(isMobile
                ? { flex: 1, width: '100%' }
                : { maxHeight: '100%' }),
            }}
          >
            {isMobile && navEntries.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                {navEntries.map((e) => (
                  <button
                    key={e.key}
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); e.onClick(); }}
                    aria-label={e.label}
                    aria-pressed={e.active}
                    style={{
                      width: 40, height: 40,
                      borderRadius: '50%',
                      background: '#2a3140',
                      border: e.active ? '2px solid #c9a84c' : '2px solid rgba(26,22,20,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      padding: 0,
                      position: 'relative',
                      flexShrink: 0,
                    }}
                  >
                    {e.imageSrc && (
                      <img
                        src={e.imageSrc}
                        alt=""
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    {!e.imageSrc && (
                      <span
                        className="font-serif"
                        style={{ color: '#ffffff', fontSize: '1rem', lineHeight: 1, position: 'relative' }}
                      >
                        {e.label}
                      </span>
                    )}
                  </button>
                ))}
                </div>
                {overlayAudio && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleAudio(overlayAudio); }}
                    aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                    style={{
                      flexShrink: 0,
                      width: 40, height: 40,
                      borderRadius: '50%',
                      background: isPlaying ? '#1a1614' : 'rgba(26,22,20,0.12)',
                      color: isPlaying ? '#c9a84c' : '#1a1614',
                      border: '2px solid rgba(26,22,20,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: isPlaying ? '0 0 0 3px rgba(201,168,76,0.25)' : 'none',
                      transition: 'background 0.2s, box-shadow 0.2s',
                      padding: 0,
                    }}
                  >
                    {isPlaying ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                        <rect x="3" y="2" width="3" height="10" rx="0.5" />
                        <rect x="8" y="2" width="3" height="10" rx="0.5" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M3 5.5v5h2.5L9 13V3L5.5 5.5H3z" />
                        <path d="M11 5c.8.5 1.5 1.7 1.5 3s-.7 2.5-1.5 3" stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            )}
            {overlayTitle && (
              <div className="font-serif italic text-[#1a1614]" style={{ fontSize: '1.3rem', lineHeight: 1.2 }}>
                {overlayTitle}
              </div>
            )}
            {/* Desktop: speaker icon still lives at top-right of the title row */}
            {!isMobile && overlayAudio && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleAudio(overlayAudio); }}
                aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                style={{
                  position: 'absolute',
                  top: 16, right: 16,
                  width: 36, height: 36,
                  borderRadius: '50%',
                  background: isPlaying ? '#1a1614' : 'rgba(26,22,20,0.12)',
                  color: isPlaying ? '#c9a84c' : '#1a1614',
                  border: '1px solid rgba(26,22,20,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: isPlaying ? '0 0 0 3px rgba(201,168,76,0.25)' : 'none',
                  transition: 'background 0.2s, box-shadow 0.2s',
                  padding: 0,
                }}
              >
                {isPlaying ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <rect x="3" y="2" width="3" height="10" rx="0.5" />
                    <rect x="8" y="2" width="3" height="10" rx="0.5" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3 5.5v5h2.5L9 13V3L5.5 5.5H3z" />
                    <path d="M11 5c.8.5 1.5 1.7 1.5 3s-.7 2.5-1.5 3" stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            )}
            <div
              className="font-serif text-[#1a1614] leading-relaxed"
              style={{ whiteSpace: 'pre-wrap', fontSize: '1.075rem' }}
            >
              {overlayText}
            </div>
          </div>
        );

        if (isMobile) {
          // Fullscreen panel: sits below the sticky nav, covers the banner + timeline.
          // zIndex inline to beat the timeline circles — Tailwind v4 `z-*` is unreliable.
          return (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                zIndex: 9999,
                top: MOBILE_NAV_H,
                left: 0,
                right: 0,
                bottom: 0,
                padding: 12,
                animation: 'fadeIn 0.25s ease-out',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {innerPanel}
            </div>
          );
        }

        // Desktop — anchored to the circle as before
        return (
          <div
            className="absolute z-20"
            style={{
              left: anchorX + 8,
              top: isBackstory ? 20 : anchorY + 8,
              right: isBackstory ? 12 : undefined,
              maxWidth: isBackstory ? undefined : 460,
              animation: 'fadeIn 0.4s ease-out',
              pointerEvents: 'none',
            }}
          >
            {innerPanel}
          </div>
        );
      })()}

      {/* Journey map — horizontal scroll on desktop, vertical stack on mobile */}
      <div
        ref={scrollRef}
        className={isMobile ? 'pb-4' : 'overflow-x-auto pb-4'}
        style={{ scrollbarColor: '#5a4f46 transparent', paddingLeft: 0, paddingRight: 0 }}
      >
        <div className="relative" style={{ width: isMobile ? '100%' : totalW, height: totalH }}>

          {/* Terrain boxes — contiguous; row on desktop, column on mobile */}
          {sessions.map((session, i) => {
            const terrain = TERRAIN_STYLES[session.terrain] ?? TERRAIN_STYLES.woods;
            const boxBg = BOX_BLUES[i % BOX_BLUES.length];
            const bgKey = `s${session.number}_bg`;
            const bgImage = imageMap[bgKey];
            const isDragOver = dragTarget === bgKey;
            const hasStarted = !!session.started_at;

            const sepBorder = '1px solid rgba(150,180,210,0.15)';
            const dragBorder = '2px solid #4a7a5a';
            const boxStyle: React.CSSProperties = isMobile
              ? {
                  left: 0,
                  top: i * boxH,
                  width: '100%',
                  height: boxH,
                  background: boxBg,
                  borderTop: isDragOver ? dragBorder : (i === 0 ? 'none' : sepBorder),
                  borderRight: isDragOver ? dragBorder : 'none',
                  borderBottom: isDragOver ? dragBorder : 'none',
                  borderLeft: isDragOver ? dragBorder : 'none',
                }
              : {
                  left: i * boxW,
                  top: 0,
                  width: boxW,
                  height: boxH,
                  background: boxBg,
                  borderTop: isDragOver ? dragBorder : 'none',
                  borderRight: isDragOver ? dragBorder : 'none',
                  borderBottom: isDragOver ? dragBorder : 'none',
                  borderLeft: isDragOver ? dragBorder : (i === 0 ? 'none' : sepBorder),
                };

            return (
              <div
                key={session.id}
                className="absolute overflow-hidden"
                style={{
                  ...boxStyle,
                  transform: isDragOver ? 'scale(1.02)' : undefined,
                  transition: 'border 0.15s, transform 0.15s',
                }}
                onDragOver={(e) => onDragOver(e, bgKey)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, session.number, 'bg')}
              >
                {/* Box background image — uploaded bg always shows; default placeholder only for started sessions */}
                {bgImage ? (
                  <img
                    src={bgImage}
                    alt={terrain.label}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : hasStarted ? (
                  <Image
                    src={`/images/journey/journey_box_${i + 1}.png`}
                    alt={terrain.label}
                    fill
                    className="object-cover opacity-30"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : null}
                {/* Session title at bottom of active terrain box */}
                {activeJournal === session.number && session.journal_public && (
                  <div style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-serif, EB Garamond, serif)',
                      fontSize: '1.1rem',
                      color: 'rgba(201,168,76,0.85)',
                    }}>
                      {session.title || `Session ${session.number}`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Placeholder panes — planning surface for future sessions.
              DM can drop a bg image onto these even before the session row exists;
              the upload is keyed by session number and re-renders next reload. */}
          {Array.from({ length: PLACEHOLDER_PANES }).map((_, p) => {
            const idx = sessions.length + p;
            const sessionNumber = sessions.length + p + 1;
            const bgKey = `s${sessionNumber}_bg`;
            const bgImage = imageMap[bgKey];
            const isDragOver = dragTarget === bgKey;
            const phStyle: React.CSSProperties = isMobile
              ? { left: 0, top: idx * boxH, width: '100%', height: boxH }
              : { left: idx * boxW, top: 0, width: boxW, height: boxH };
            return (
              <div
                key={`placeholder-${p}`}
                className="absolute overflow-hidden"
                style={{
                  ...phStyle,
                  background: 'var(--color-bg)',
                  border: isDragOver ? '2px solid #4a7a5a' : '0.5px solid rgba(255,255,255,0.25)',
                  transform: isDragOver ? 'scale(1.02)' : undefined,
                  transition: 'border 0.15s, transform 0.15s',
                }}
                onDragOver={readOnly ? undefined : (e) => onDragOver(e, bgKey)}
                onDragLeave={readOnly ? undefined : onDragLeave}
                onDrop={readOnly ? undefined : (e) => onDrop(e, sessionNumber, 'bg')}
              >
                {bgImage && (
                  <img
                    src={bgImage}
                    alt=""
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
            );
          })}

          {/* SVG Path — mobile uses a % viewBox so the weave scales with viewport */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: isMobile ? '100%' : totalW, height: totalH }}
            {...(isMobile
              ? { viewBox: `0 0 100 ${totalH}`, preserveAspectRatio: 'none' }
              : {})}
          >
            {/* Dim continuation through the placeholder panes — drawn first so the
                real session path sits visually on top at the handoff point */}
            <path
              d={buildPathFrom(dimPathPoints)}
              fill="none"
              stroke="rgba(150,175,200,0.5)"
              strokeWidth="3"
              strokeDasharray="8 4"
              opacity="0.2"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={buildPathFrom(pathPoints)}
              fill="none"
              stroke="rgba(150,175,200,0.5)"
              strokeWidth="3"
              strokeDasharray="8 4"
              opacity="0.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Session stop circles */}
          {sessions.map((session, i) => {
            const pt = pathPoints[i];
            const circleKey = `s${session.number}_circle`;
            const circleImage = imageMap[circleKey];
            const isDragOver = dragTarget === circleKey;
            const hasStarted = !!session.started_at;
            const isActive = activeJournal === session.number;
            const canOpen = !!session.journal_public;

            // Mobile positions circles by percentage (x is 30/70 in viewBox units).
            // Desktop uses pixel coords. Both use translate(-50%, -50%) centering on mobile.
            const circlePos: React.CSSProperties = isMobile
              ? { left: `${pt.x}%`, top: pt.y, transform: 'translate(-50%, -50%)' }
              : { left: pt.x - circleR, top: pt.y - circleR };

            return (
              <div
                key={session.id}
                className="absolute group"
                style={{
                  ...circlePos,
                  cursor: canOpen ? 'pointer' : 'default',
                }}
                title={hasStarted ? (session.title || `Session ${session.number}`) : `Session ${session.number}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canOpen) return;
                  setActiveJournal(isActive ? null : session.number);
                  setShowBackstory(false);
                }}
              >
                <div
                  className="rounded-full flex flex-col items-center justify-center overflow-hidden transition-all group-hover:scale-110 relative"
                  style={{
                    width: circleR * 2,
                    height: circleR * 2,
                    background: hasStarted ? 'rgba(255,255,255,0.9)' : 'rgba(200,200,220,0.4)',
                    border: isDragOver ? '2px solid #4a7a5a' : isActive ? '3px solid rgba(201,168,76,0.7)' : '3px solid #000000',
                    transform: isDragOver ? 'scale(1.1)' : undefined,
                  }}
                  onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(circleKey); }}
                  onDragLeave={readOnly ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(null); }}
                  onDrop={readOnly ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files[0]; if (file && file.type.startsWith('image/')) { handleDrop(session.number, 'circle', file); } else { setDragTarget(null); } }}
                >
                  {hasStarted ? (
                    <>
                      {!circleImage && (
                        <>
                          <span className="text-[#2a3140] font-serif text-2xl select-none z-10 leading-none">{session.number}</span>
                          <span className="text-[#4a5568] font-serif text-[0.45rem] select-none z-10 leading-tight text-center px-1.5 mt-0.5" style={{ maxWidth: circleR * 2 - 8 }}>
                            {session.title || `Session ${session.number}`}
                          </span>
                        </>
                      )}
                      {circleImage && (
                        <img
                          src={circleImage}
                          alt={`Session ${session.number}`}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </>
                  ) : (
                    <img
                      src="/images/journey/moon.png"
                      alt="Unknown"
                      style={{ position: 'absolute', inset: '-5%', width: '110%', height: '110%', objectFit: 'cover', opacity: 0.6 }}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Placeholder circles — future sessions, very light.
              DM-droppable: an uploaded circle image renders here even before
              the session row exists. */}
          {placeholderPoints.map((pt, p) => {
            const sessionNumber = sessions.length + p + 1;
            const circleKey = `s${sessionNumber}_circle`;
            const circleImage = imageMap[circleKey];
            const isDragOver = dragTarget === circleKey;
            const phPos: React.CSSProperties = isMobile
              ? { left: `${pt.x}%`, top: pt.y, transform: 'translate(-50%, -50%)' }
              : { left: pt.x - circleR, top: pt.y - circleR };
            return (
              <div
                key={`placeholder-circle-${p}`}
                className="absolute"
                style={{
                  ...phPos,
                  width: circleR * 2,
                  height: circleR * 2,
                }}
              >
                <div
                  className="rounded-full flex items-center justify-center overflow-hidden relative"
                  style={{
                    width: circleR * 2,
                    height: circleR * 2,
                    background: 'rgba(200,200,220,0.12)',
                    border: isDragOver ? '2px solid #4a7a5a' : '1px solid rgba(255,255,255,0.18)',
                    transform: isDragOver ? 'scale(1.1)' : undefined,
                    transition: 'border 0.15s, transform 0.15s',
                  }}
                  onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(circleKey); }}
                  onDragLeave={readOnly ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(null); }}
                  onDrop={readOnly ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files[0]; if (file && file.type.startsWith('image/')) { handleDrop(sessionNumber, 'circle', file); } else { setDragTarget(null); } }}
                >
                  {circleImage ? (
                    <img
                      src={circleImage}
                      alt={`Session ${sessionNumber}`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span
                      className="font-serif select-none leading-none"
                      style={{ fontSize: '2.6rem', color: 'rgba(255,255,255,0.18)' }}
                    >
                      {sessionNumber}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
}
