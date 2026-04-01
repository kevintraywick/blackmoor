'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import type { Player } from '@/lib/types';
import type { Availability } from '@/lib/types';

// ── helpers ──────────────────────────────────────────────────────────────────

// Hardcoded dates — replace with calendar system later
function getNextSaturdays(): string[] {
  return ['2026-04-04', '2026-04-11', '2026-04-18'];
}

function formatSaturday(iso: string): { month: string; day: string } {
  const d = new Date(iso + 'T12:00:00');
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    day: String(d.getDate()),
  };
}

// ── types ────────────────────────────────────────────────────────────────────

interface Props {
  players: Player[];
  initialAvailability: Availability[];
  quorum: number;
}

// ── component ────────────────────────────────────────────────────────────────

export default function CanYouPlayClient({ players, initialAvailability, quorum }: Props) {
  const saturdays = getNextSaturdays();

  // Build availability map: "playerId:saturday" → status
  const [avMap, setAvMap] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const row of initialAvailability) {
      m.set(`${row.player_id}:${row.saturday}`, row.status);
    }
    return m;
  });

  const getStatus = useCallback((playerId: string, saturday: string): 'in' | 'maybe' | 'out' | 'unseen' => {
    return (avMap.get(`${playerId}:${saturday}`) as 'in' | 'maybe' | 'out') ?? 'unseen';
  }, [avMap]);

  const playSound = useCallback((status: 'in' | 'out') => {
    const src = status === 'in' ? '/audio/swords.mp3' : '/audio/run_away.mp3';
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, []);

  const toggle = useCallback(async (playerId: string, saturday: string) => {
    const current = getStatus(playerId, saturday);
    // unseen → in → out → in → out ...
    const next = current === 'unseen' ? 'in' : current === 'in' ? 'out' : 'in';

    playSound(next);

    // Optimistic update
    setAvMap(prev => {
      const m = new Map(prev);
      m.set(`${playerId}:${saturday}`, next);
      return m;
    });

    await fetch('/api/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, saturday, status: next }),
    });
  }, [getStatus]);

  const getInCount = useCallback((saturday: string): number => {
    return players.filter(p => getStatus(p.id, saturday) === 'in').length;
  }, [players, getStatus]);

  return (
    <div className="min-h-screen relative" style={{ background: '#1a1614' }}>
      {/* Background image */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/images/canyouplay/canyouplay_splash.png"
          alt=""
          fill
          className="object-cover opacity-30"
          priority
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(26,22,20,0.3) 0%, rgba(26,22,20,0.85) 50%, rgba(26,22,20,1) 80%)' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1000px] mx-auto px-6 py-10">
        {/* Header */}
        <h1 className="font-serif text-4xl text-[#e8ddd0] text-center mb-2 tracking-wide">
          Are You In?
        </h1>
        <p className="text-center text-[#8a7d6e] font-sans text-sm mb-4 sm:mb-10">
          Tap your name
        </p>

        {/* Saturday columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 mb-12">
          {saturdays.map(sat => {
            const { month, day } = formatSaturday(sat);
            const inCount = getInCount(sat);
            const quorumMet = inCount >= quorum;
            return (
              <div key={sat} className="flex flex-col items-center">
                {/* Date */}
                <div
                  className="rounded-full flex flex-col items-center justify-center mb-4"
                  style={{ width: 77, height: 77, border: '2px solid rgba(201,168,76,0.3)', flexShrink: 0 }}
                >
                  <div className="font-sans uppercase tracking-[0.15em] text-[#c9a84c] leading-none" style={{ fontSize: '0.77rem' }}>
                    {month}
                  </div>
                  <div className="font-serif text-[#e8ddd0] leading-none mt-0.5" style={{ fontSize: '1.65rem' }}>
                    {day}
                  </div>
                </div>

                {/* Player list */}
                <div className="w-full space-y-2" style={{ marginTop: '10px' }}>
                  {players.map(p => {
                    const status = getStatus(p.id, sat);
                    const isIn = status === 'in';
                    const isOut = status === 'out';
                    const unseen = status === 'unseen';

                    return (
                      <button
                        key={p.id}
                        onClick={() => toggle(p.id, sat)}
                        className="w-full flex items-center gap-3 px-3 py-1.5 sm:py-2 rounded transition-all duration-200"
                        style={{
                          background: unseen ? 'rgba(90,79,70,0.15)' : 'rgba(201,168,76,0.08)',
                          border: `1px solid ${unseen ? 'rgba(90,79,70,0.2)' : 'rgba(201,168,76,0.15)'}`,
                        }}
                      >
                        {/* Portrait */}
                        <div
                          className="relative w-10 h-10 sm:w-8 sm:h-8 rounded-full overflow-hidden flex-shrink-0 transition-all duration-200"
                          style={{
                            opacity: unseen ? 0.3 : 1,
                            filter: unseen ? 'grayscale(1)' : 'none',
                            border: `2px solid ${unseen ? '#3d3530' : '#8b1a1a'}`,
                          }}
                        >
                          <Image src={p.img} alt={p.character} fill className="object-cover" />
                        </div>

                        {/* Name */}
                        <span
                          className="font-serif text-base sm:text-sm flex-1 text-left transition-all duration-200"
                          style={{
                            color: unseen ? '#7a6e63' : '#e8ddd0',
                          }}
                        >
                          {p.character}
                        </span>

                        {/* Status circle: white ? → green → red */}
                        <span
                          className="w-5 h-5 sm:w-4 sm:h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200"
                          style={{
                            background: isIn ? '#2d8a4e' : isOut ? '#8b1a1a' : '#1a1614',
                            border: '1px solid rgba(255,255,255,0.5)',
                            boxShadow: isIn ? '0 0 6px rgba(45,138,78,0.6)' : isOut ? '0 0 6px rgba(139,26,26,0.6)' : 'none',
                            color: '#fff',
                            fontSize: '1rem',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 600,
                          }}
                        >
                          {unseen ? '?' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* In count */}
                <div className="font-serif mt-4 self-end" style={{ fontSize: '1.85rem', color: '#d0ccc6', marginRight: 6 }}>
                  {inCount}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
