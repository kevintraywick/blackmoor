'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import type { Player } from '@/lib/types';
import type { Availability } from '@/lib/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function getNextSaturdays(count: number): string[] {
  const dates: string[] = [];
  const d = new Date();
  // advance to next Saturday (or today if already Saturday)
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  for (let i = 0; i < count; i++) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

function formatSaturday(iso: string): { month: string; day: string } {
  const d = new Date(iso + 'T12:00:00');
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    day: String(d.getDate()),
  };
}

// Count consecutive sessions attended (from most recent backward)
function getStreak(playerId: string, sessionDates: Set<string>, avMap: Map<string, string>): number {
  // Get all past saturdays from sessionDates, sorted descending
  const today = new Date().toISOString().slice(0, 10);
  const pastDates = Array.from(sessionDates)
    .filter(d => d <= today)
    .sort((a, b) => b.localeCompare(a));

  let streak = 0;
  for (const date of pastDates) {
    const key = `${playerId}:${date}`;
    const status = avMap.get(key);
    // Only explicit 'in' counts as attended (default-out model)
    if (status === 'in') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── types ────────────────────────────────────────────────────────────────────

interface Props {
  players: Player[];
  initialAvailability: Availability[];
  quorum: number;
  sessionDates: string[];
}

// ── component ────────────────────────────────────────────────────────────────

export default function CanYouPlayClient({ players, initialAvailability, quorum, sessionDates }: Props) {
  const saturdays = getNextSaturdays(3);
  const sessionDateSet = new Set(sessionDates);

  // Build availability map: "playerId:saturday" → status
  const [avMap, setAvMap] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const row of initialAvailability) {
      m.set(`${row.player_id}:${row.saturday}`, row.status);
    }
    return m;
  });

  const getStatus = useCallback((playerId: string, saturday: string): 'in' | 'out' => {
    return (avMap.get(`${playerId}:${saturday}`) as 'in' | 'out') ?? 'out';
  }, [avMap]);

  const toggle = useCallback(async (playerId: string, saturday: string) => {
    const current = getStatus(playerId, saturday);
    const next = current === 'in' ? 'out' : 'in';

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
          Can You Play?
        </h1>
        <p className="text-center text-[#8a7d6e] font-sans text-sm mb-10">
          Tap your name to mark yourself in.
        </p>

        {/* Saturday columns */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {saturdays.map(sat => {
            const { month, day } = formatSaturday(sat);
            const inCount = getInCount(sat);
            const quorumMet = inCount >= quorum;
            return (
              <div key={sat} className="flex flex-col items-center">
                {/* Date */}
                <div
                  className="w-16 h-16 rounded-full flex flex-col items-center justify-center mb-4"
                  style={{ border: '2px solid rgba(201,168,76,0.3)' }}
                >
                  <div className="font-sans text-[0.7rem] uppercase tracking-[0.15em] text-[#c9a84c] leading-none">
                    {month}
                  </div>
                  <div className="font-serif text-2xl text-[#e8ddd0] leading-none mt-0.5">
                    {day}
                  </div>
                </div>

                {/* Quorum indicator — fixed height box */}
                <div className="relative mb-4 flex items-center justify-center" style={{ width: '70px', height: '70px', marginTop: '10px' }}>
                  {quorumMet ? (
                    <img
                      src="/images/canyouplay/bonfire.gif"
                      alt="Quorum met!"
                      className="object-contain"
                      style={{ width: '70px', height: '70px' }}
                    />
                  ) : inCount > 0 ? (
                    <img
                      src={`/images/canyouplay/torch_${inCount}player${inCount > 1 ? 's' : ''}.gif`}
                      alt={`${inCount} player${inCount > 1 ? 's' : ''} confirmed`}
                      className="object-contain"
                      style={{ width: '70px', height: '70px' }}
                    />
                  ) : (
                    <div
                      className="font-sans text-xs text-center leading-tight"
                      style={{ color: '#8a7d6e' }}
                    >
                      {quorum - inCount === 1 ? '1 player needed...' : `${quorum - inCount} players needed...`}
                    </div>
                  )}
                </div>

                {/* Player list */}
                <div className="w-full space-y-2">
                  {players.map(p => {
                    const status = getStatus(p.id, sat);
                    const isOut = status === 'out';
                    const streak = getStreak(p.id, sessionDateSet, avMap);

                    return (
                      <button
                        key={p.id}
                        onClick={() => toggle(p.id, sat)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded transition-all duration-200"
                        style={{
                          background: isOut ? 'rgba(90,79,70,0.15)' : 'rgba(201,168,76,0.08)',
                          border: `1px solid ${isOut ? 'rgba(90,79,70,0.2)' : 'rgba(201,168,76,0.15)'}`,
                        }}
                      >
                        {/* Portrait */}
                        <div
                          className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 transition-all duration-200"
                          style={{
                            opacity: isOut ? 0.3 : 1,
                            filter: isOut ? 'grayscale(1)' : 'none',
                            border: `2px solid ${isOut ? '#3d3530' : '#8b1a1a'}`,
                          }}
                        >
                          <Image src={p.img} alt={p.character} fill className="object-cover" />
                        </div>

                        {/* Name */}
                        <span
                          className="font-serif text-sm flex-1 text-left transition-all duration-200"
                          style={{
                            color: isOut ? '#5a4f46' : '#e8ddd0',
                            textDecoration: 'none',
                          }}
                        >
                          {p.character}
                        </span>

                        {/* Streak runes */}
                        {streak > 0 && !isOut && (
                          <span
                            className="font-sans text-[0.6rem] tracking-wider text-[#c9a84c]"
                            title={`${streak} session streak`}
                            style={{ opacity: 0.6 + Math.min(streak, 5) * 0.08 }}
                          >
                            {'▮'.repeat(Math.min(streak, 8))}
                          </span>
                        )}

                        {/* Status indicator */}
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[0.6rem]"
                          style={{
                            border: isOut ? '1.5px solid #5a4f46' : '1.5px solid #4a7a5a',
                            background: isOut ? 'transparent' : '#4a7a5a',
                            color: isOut ? 'transparent' : '#fff',
                          }}
                        >
                          {isOut ? '' : '✓'}
                        </span>
                      </button>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
