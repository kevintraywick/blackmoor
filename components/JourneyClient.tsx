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
}

export default function JourneyClient({ sessions, imageMap: initialImageMap = {}, campaignBackground = '' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imageMap, setImageMap] = useState<Record<string, string>>(initialImageMap);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  // Box dimensions — contiguous, no gaps
  const boxW = 200;
  const boxH = 450;
  const totalW = sessions.length * boxW;
  const circleR = 60; // radius of session circles (120px diameter)

  // Generate path points — weave up and down
  const pathPoints = sessions.map((_, i) => {
    const x = i * boxW + boxW / 2;
    const y = i % 2 === 0 ? boxH * 0.65 : boxH * 0.3;
    return { x, y };
  });

  // Build SVG path string with smooth curves
  function buildPath(): string {
    if (pathPoints.length === 0) return '';
    let d = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
    for (let i = 1; i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1];
      const curr = pathPoints[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }

  // Upload handler for drag-and-drop (session images)
  const handleDrop = useCallback(async (sessionNumber: number, slot: 'circle' | 'bg', file: File) => {
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
  }, []);

  // Upload handler for named keys (e.g. campaign_bg)
  const handleKeyDrop = useCallback(async (key: string, file: File) => {
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
  }, []);

  const onDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(key);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(null);
  };

  const onDrop = (e: React.DragEvent, sessionNumber: number, slot: 'circle' | 'bg') => {
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
    <div className="max-w-full mx-auto relative" onClick={() => { setActiveJournal(null); setShowBackstory(false); }}>
      {uploadError && (
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
                left: boxW / 2 - circleR,
                width: circleR * 2,
                height: circleR * 2,
                border: isDragOver ? '3px solid #4a7a5a' : '3px solid #000000',
                background: 'rgba(200,200,220,0.4)',
                transform: isDragOver ? 'scale(1.1)' : undefined,
                transition: 'border 0.15s, transform 0.15s',
                cursor: campaignBackground ? 'pointer' : 'default',
              }}
              onClick={(e) => { e.stopPropagation(); if (campaignBackground) { setShowBackstory(prev => !prev); setActiveJournal(null); } }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(key); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(null); }}
              onDrop={(e) => {
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
              <div className="absolute z-10 flex flex-col items-center select-none" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)', lineHeight: 1.15 }}>
                <span className="font-serif italic text-white text-[1.05rem] tracking-[0.02em]">Our Story</span>
                <span className="font-serif italic text-white text-[1.05rem] tracking-[0.02em]">So Far…</span>
              </div>
            </div>
          );
        })()}

        <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      </div>

      {/* Text overlay — anchored to bottom-right of selected circle */}
      {(() => {
        let overlayText: string | null = null;
        let overlayTitle: string | null = null;
        let anchorX = 0;
        let anchorY = 0;

        if (showBackstory && campaignBackground) {
          overlayText = campaignBackground;
          // Backstory circle is in the banner at (boxW/2, circleR)
          anchorX = boxW / 2 + circleR;
          anchorY = 200; // bottom of the banner
        } else if (activeJournal !== null) {
          const idx = sessions.findIndex(s => s.number === activeJournal);
          const s = idx >= 0 ? sessions[idx] : null;
          if (s?.journal_public && idx >= 0) {
            overlayText = s.journal_public;
            overlayTitle = s.title || `Session ${s.number}`;
            const pt = pathPoints[idx];
            // Anchor at bottom-right of the circle, offset into the scroll area (below banner)
            anchorX = pt.x + circleR * 0.7;
            anchorY = 200 + pt.y + circleR * 0.7; // 200 = banner height
          }
        }
        if (!overlayText) return null;
        const isBackstory = showBackstory;
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
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'rgba(255,255,255,0.70)',
                backdropFilter: 'blur(10px)',
                borderRadius: 8,
                padding: '20px 28px',
                pointerEvents: 'auto',
              }}
            >
              {overlayTitle && (
                <div className="font-serif italic text-[#1a1614] text-[1.25rem] mb-2">{overlayTitle}</div>
              )}
              <div
                className="font-serif text-[#1a1614] text-[1.075rem] leading-relaxed"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {overlayText}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Journey map — horizontal scroll */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-4"
        style={{ scrollbarColor: '#5a4f46 transparent', paddingLeft: 0, paddingRight: 0 }}
      >
        <div className="relative" style={{ width: totalW, height: boxH + 40 }}>

          {/* Terrain boxes — contiguous, top to bottom */}
          {sessions.map((session, i) => {
            const terrain = TERRAIN_STYLES[session.terrain] ?? TERRAIN_STYLES.woods;
            const x = i * boxW;
            const boxBg = BOX_BLUES[i % BOX_BLUES.length];
            const bgKey = `s${session.number}_bg`;
            const bgImage = imageMap[bgKey];
            const isDragOver = dragTarget === bgKey;
            const hasStarted = !!session.started_at;

            return (
              <div
                key={session.id}
                className="absolute overflow-hidden"
                style={{
                  left: x,
                  top: 0,
                  width: boxW,
                  height: boxH,
                  background: boxBg,
                  borderLeft: i === 0 ? 'none' : '1px solid rgba(150,180,210,0.15)',
                  borderRight: 'none',
                  border: isDragOver ? '2px solid #4a7a5a' : undefined,
                  transform: isDragOver ? 'scale(1.02)' : undefined,
                  transition: 'border 0.15s, transform 0.15s',
                }}
                onDragOver={(e) => onDragOver(e, bgKey)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, session.number, 'bg')}
              >
                {/* Box background image — only show for started sessions */}
                {hasStarted && bgImage ? (
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

          {/* SVG Path */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: totalW, height: boxH + 40 }}
          >
            <path
              d={buildPath()}
              fill="none"
              stroke="rgba(150,175,200,0.5)"
              strokeWidth="3"
              strokeDasharray="8 4"
              opacity="0.6"
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
            const canOpen = hasStarted && !!session.journal_public;

            return (
              <div
                key={session.id}
                className="absolute group"
                style={{
                  left: pt.x - circleR,
                  top: pt.y - circleR,
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
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(circleKey); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(null); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files[0]; if (file && file.type.startsWith('image/')) { handleDrop(session.number, 'circle', file); } else { setDragTarget(null); } }}
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

        </div>
      </div>

    </div>
  );
}
