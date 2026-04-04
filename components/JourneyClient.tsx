'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef, useState, useCallback } from 'react';
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
}

export default function JourneyClient({ sessions, imageMap: initialImageMap = {} }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imageMap, setImageMap] = useState<Record<string, string>>(initialImageMap);
  const [dragTarget, setDragTarget] = useState<string | null>(null);

  // Box dimensions — contiguous, no gaps
  const boxW = 160;
  const boxH = 500;
  const totalW = sessions.length * boxW + 100;
  const circleR = 48; // radius of session circles (96px diameter)

  // Generate path points — weave up and down
  const pathPoints = sessions.map((_, i) => {
    const x = 50 + i * boxW + boxW / 2;
    const y = i % 2 === 0 ? boxH * 0.3 : boxH * 0.65;
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

  // Upload handler for drag-and-drop
  const handleDrop = useCallback(async (sessionNumber: number, slot: 'circle' | 'bg', file: File) => {
    const formData = new FormData();
    formData.append('session_number', String(sessionNumber));
    formData.append('slot', slot);
    formData.append('image', file);

    try {
      const res = await fetch('/api/uploads/journey', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.path) {
        setImageMap(prev => ({ ...prev, [`s${sessionNumber}_${slot}`]: data.path + '?t=' + Date.now() }));
      }
    } catch {
      // silent fail
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
    <div className="max-w-full mx-auto">
      {/* Banner */}
      <div className="relative w-full h-[200px] overflow-hidden">
        <Image
          src="/images/journey/journey_splash.png"
          alt="Journey"
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      {/* Journey map — horizontal scroll */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-4 px-4 pt-4"
        style={{ scrollbarColor: '#5a4f46 transparent' }}
      >
        <div className="relative" style={{ width: totalW, height: boxH + 40 }}>

          {/* Terrain boxes — contiguous, top to bottom */}
          {sessions.map((session, i) => {
            const terrain = TERRAIN_STYLES[session.terrain] ?? TERRAIN_STYLES.woods;
            const x = 50 + i * boxW;
            const boxBg = BOX_BLUES[i % BOX_BLUES.length];
            const bgKey = `s${session.number}_bg`;
            const bgImage = imageMap[bgKey];
            const isDragOver = dragTarget === bgKey;

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
                {/* Box background image */}
                {bgImage ? (
                  <img
                    src={bgImage}
                    alt={terrain.label}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <Image
                    src={`/images/journey/journey_box_${i + 1}.png`}
                    alt={terrain.label}
                    fill
                    className="object-cover opacity-30"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
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

            return (
              <Link
                key={session.id}
                href="/dm"
                className="absolute no-underline group"
                style={{
                  left: pt.x - circleR,
                  top: pt.y - circleR,
                }}
                title={session.title || `Session ${session.number}`}
              >
                <div
                  className="rounded-full flex flex-col items-center justify-center overflow-hidden transition-all group-hover:scale-110 relative"
                  style={{
                    width: circleR * 2,
                    height: circleR * 2,
                    background: 'rgba(255,255,255,0.9)',
                    border: isDragOver ? '2px solid #4a7a5a' : '2px solid rgba(180,200,220,0.5)',
                    transform: isDragOver ? 'scale(1.1)' : undefined,
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(circleKey); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(null); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files[0]; if (file && file.type.startsWith('image/')) { handleDrop(session.number, 'circle', file); } else { setDragTarget(null); } }}
                >
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
                </div>
              </Link>
            );
          })}

        </div>
      </div>
    </div>
  );
}
