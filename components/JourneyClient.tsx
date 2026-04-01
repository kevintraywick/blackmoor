'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef } from 'react';
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
}

export default function JourneyClient({ sessions }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
            const boxImage = `/images/journey/journey_box_${i + 1}.png`;
            const boxBg = BOX_BLUES[i % BOX_BLUES.length];

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
                  borderLeft: i === 0 ? 'none' : `1px solid rgba(150,180,210,0.15)`,
                  borderRight: 'none',
                }}
              >
                {/* Box background image */}
                <Image
                  src={boxImage}
                  alt={terrain.label}
                  fill
                  className="object-cover opacity-30"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {/* Terrain label at bottom */}
                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <span className="font-sans text-[0.5rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] opacity-50">
                    {terrain.label}
                  </span>
                </div>
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

          {/* Session stop circles — 3x size (72px) */}
          {sessions.map((session, i) => {
            const pt = pathPoints[i];
            const stopImage = `/images/journey/stop_${session.number}.png`;

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
                  className="rounded-full border-2 border-[rgba(180,200,220,0.5)] flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-[var(--color-gold)] group-hover:scale-110 relative"
                  style={{ width: circleR * 2, height: circleR * 2, background: 'rgba(255,255,255,0.9)' }}
                >
                  <span className="text-[#2a3140] font-serif text-2xl select-none z-10 leading-none">{session.number}</span>
                  <span className="text-[#4a5568] font-serif text-[0.45rem] select-none z-10 leading-tight text-center px-1.5 mt-0.5" style={{ maxWidth: circleR * 2 - 8 }}>
                    {session.title || `Session ${session.number}`}
                  </span>
                  <Image
                    src={stopImage}
                    alt={`Session ${session.number}`}
                    fill
                    className="object-cover absolute inset-0 opacity-70"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              </Link>
            );
          })}

        </div>
      </div>
    </div>
  );
}
