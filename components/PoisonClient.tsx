'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { Player } from '@/lib/types';
import type { PoisonStatus } from '@/lib/types';

interface Props {
  players: Player[];
  initialPoisons: PoisonStatus[];
}

function timeRemaining(poison: PoisonStatus): string | null {
  if (poison.duration === 'long_rest') return null;
  const mins = parseInt(poison.duration, 10);
  if (isNaN(mins)) return null;
  const elapsed = (Date.now() / 1000) - poison.started_at;
  const remaining = (mins * 60) - elapsed;
  if (remaining <= 0) return 'expired';
  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PoisonClient({ players, initialPoisons }: Props) {
  const [poisons, setPoisons] = useState<PoisonStatus[]>(initialPoisons);
  const [timerInputs, setTimerInputs] = useState<Record<string, string>>({});
  const [poisonLabels, setPoisonLabels] = useState<Record<string, string>>({});
  const [durationMode, setDurationMode] = useState<Record<string, 'long_rest' | 'timer'>>({});
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0);

  // Tick every second + auto-expire sweep. Combined so the sweep runs off the
  // interval (not a render-effect) and setState only fires when something is
  // actually expiring.
  useEffect(() => {
    const hasTimers = poisons.some(p => p.duration !== 'long_rest');
    if (!hasTimers) return;
    tickRef.current = setInterval(() => {
      setTick(t => t + 1);
      setPoisons(prev => {
        const expired = prev.filter(p => timeRemaining(p) === 'expired');
        if (expired.length === 0) return prev;
        for (const p of expired) {
          fetch('/api/poison', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: p.id }),
          }).catch(() => {});
        }
        const expiredIds = new Set(expired.map(p => p.id));
        return prev.filter(p => !expiredIds.has(p.id));
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [poisons]);

  const clearPoison = useCallback(async (id: string) => {
    setPoisons(prev => prev.filter(p => p.id !== id));
    await fetch('/api/poison', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }, []);

  const poisonPlayer = useCallback(async (playerId: string, duration: string) => {
    const label = poisonLabels[playerId]?.trim() || 'Poisoned';
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('blackmoor-last-session') : null;
    const res = await fetch('/api/poison', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, poison_type: label, duration, session_id: sessionId }),
    });
    const row: PoisonStatus = await res.json();
    setPoisons(prev => [...prev, row]);
    setPoisonLabels(prev => { const n = { ...prev }; delete n[playerId]; return n; });
    setTimerInputs(prev => { const n = { ...prev }; delete n[playerId]; return n; });
    setDurationMode(prev => { const n = { ...prev }; delete n[playerId]; return n; });
  }, [poisonLabels]);

  const clearAllForPlayer = useCallback(async (playerId: string) => {
    setPoisons(prev => prev.filter(p => p.player_id !== playerId));
    await fetch('/api/poison', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }),
    });
  }, []);

  function getPlayerPoisons(playerId: string): PoisonStatus[] {
    return poisons.filter(p => p.player_id === playerId);
  }

  return (
    <div className="max-w-[1000px] mx-auto px-8 py-12">
      <h1 className="font-serif text-[2rem] italic text-[var(--color-text)] leading-none tracking-tight">Poisons & Traps</h1>
      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)] mt-1.5 mb-8">
        Active Effects Tracker
      </p>

      {/* Player rows */}
      <div className="space-y-3">
        {players.map(player => {
          const active = getPlayerPoisons(player.id);
          const isPoisoned = active.length > 0;

          return (
            <div
              key={player.id}
              className="rounded-lg px-4 py-3"
              style={{
                background: isPoisoned ? 'rgba(74,122,90,0.08)' : 'rgba(90,79,70,0.08)',
                border: `1px solid ${isPoisoned ? 'rgba(74,122,90,0.25)' : 'rgba(90,79,70,0.15)'}`,
              }}
            >
              <div className="flex items-center gap-4">
                {/* Circle indicator */}
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200"
                  style={{
                    border: `2px solid ${isPoisoned ? '#4a7a5a' : '#5a4f46'}`,
                    background: isPoisoned ? '#4a7a5a' : 'transparent',
                  }}
                >
                  {isPoisoned && <span className="text-white text-[0.5rem]">✓</span>}
                </div>

                {/* Portrait */}
                <div
                  className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                  style={{
                    border: `2px solid ${isPoisoned ? '#4a7a5a' : '#3d3530'}`,
                    filter: isPoisoned ? 'hue-rotate(60deg) saturate(1.3)' : 'none',
                  }}
                >
                  <Image src={player.img} alt={player.character} fill className="object-cover" />
                </div>

                {/* Name */}
                <span className="font-serif text-sm w-28 flex-shrink-0" style={{ color: isPoisoned ? '#7ac28a' : '#e8ddd0' }}>
                  {player.character}
                </span>

                {/* Status emoji */}
                <div className="w-8 text-center text-xl flex-shrink-0">
                  {isPoisoned ? '🤢' : ''}
                </div>

                {/* Duration controls */}
                <div className="flex items-center gap-2 flex-1">
                  {isPoisoned ? (
                    <>
                      {active.map(p => (
                        <div key={p.id} className="flex items-center gap-2 rounded px-2 py-1" style={{ background: 'rgba(74,122,90,0.15)' }}>
                          <span className="font-sans text-xs text-[#7ac28a]">{p.poison_type}</span>
                          <span className="font-sans text-xs text-[#8a7d6e]">
                            {p.duration === 'long_rest' ? 'Until Long Rest' : (() => {
                              const tr = timeRemaining(p);
                              return tr ? tr : '';
                            })()}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); clearPoison(p.id); }}
                            className="text-[#8a7d6e] hover:text-[#c0392b] text-xs ml-1 transition-colors"
                            title="Clear this poison"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {/* Add another poison */}
                      <button
                        onClick={() => poisonPlayer(player.id, 'long_rest')}
                        className="text-[#5a4f46] hover:text-[#7ac28a] text-xs transition-colors"
                        title="Add another poison"
                      >
                        +
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Poison name..."
                        value={poisonLabels[player.id] ?? ''}
                        onChange={e => setPoisonLabels(prev => ({ ...prev, [player.id]: e.target.value }))}
                        className="bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] text-xs font-serif outline-none px-1 py-0.5 w-28 placeholder:text-[var(--color-text-muted)]"
                      />

                      {/* Duration options */}
                      <div className="flex items-center gap-3">
                        {/* Long Rest — click to apply immediately */}
                        <button
                          onClick={() => poisonPlayer(player.id, 'long_rest')}
                          className="flex items-center gap-1.5"
                        >
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ border: '2px solid #5a4f46', background: 'transparent' }}
                          />
                          <span className="font-sans text-[0.65rem] uppercase tracking-wider text-[#8a7d6e]">Long Rest</span>
                        </button>

                        {/* Timer — click to show minutes input */}
                        <button
                          onClick={() => setDurationMode(prev => ({ ...prev, [player.id]: 'timer' }))}
                          className="flex items-center gap-1.5"
                        >
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center"
                            style={{
                              border: `2px solid ${durationMode[player.id] === 'timer' ? '#4a7a5a' : '#5a4f46'}`,
                              background: durationMode[player.id] === 'timer' ? '#4a7a5a' : 'transparent',
                            }}
                          >
                            {durationMode[player.id] === 'timer' && <span className="text-white text-[0.45rem]">✓</span>}
                          </div>
                          <span className="font-sans text-[0.65rem] uppercase tracking-wider text-[#8a7d6e]">Timer</span>
                        </button>

                        {/* Minutes +/- control — only when timer is selected */}
                        {durationMode[player.id] === 'timer' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setTimerInputs(prev => {
                                const cur = parseInt(prev[player.id] ?? '10') || 10;
                                return { ...prev, [player.id]: String(Math.max(1, cur - 1)) };
                              })}
                              className="w-[22px] h-5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm text-[0.85rem] leading-none hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] active:bg-[#3a3020] transition-colors"
                            >
                              −
                            </button>
                            <span className="text-[var(--color-text)] text-xs font-serif w-8 text-center">
                              {timerInputs[player.id] || '10'}
                            </span>
                            <button
                              onClick={() => setTimerInputs(prev => {
                                const cur = parseInt(prev[player.id] ?? '10') || 10;
                                return { ...prev, [player.id]: String(cur + 1) };
                              })}
                              className="w-[22px] h-5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm text-[0.85rem] leading-none hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] active:bg-[#3a3020] transition-colors"
                            >
                              +
                            </button>
                            <span className="text-[#8a7d6e] text-[0.6rem] uppercase tracking-wider ml-0.5">min</span>
                            <button
                              onClick={() => poisonPlayer(player.id, timerInputs[player.id] || '10')}
                              className="w-[22px] h-5 bg-[var(--color-surface-raised)] border border-[#4a7a5a] text-[#4a7a5a] rounded-sm text-[0.7rem] leading-none hover:bg-[#4a7a5a] hover:text-white transition-colors ml-1"
                              title="Start timer"
                            >
                              ▶
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cancel poison */}
                {isPoisoned && (
                  <button
                    onClick={() => clearAllForPlayer(player.id)}
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors"
                    style={{ border: '2px solid #8b1a1a', color: '#8b1a1a', background: 'transparent' }}
                    title="Clear all poisons"
                    onMouseEnter={e => { e.currentTarget.style.background = '#8b1a1a'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b1a1a'; }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
