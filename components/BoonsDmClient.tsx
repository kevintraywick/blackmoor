'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Player, BoonTemplate, PlayerBoon, BoonCategory } from '@/lib/types';

interface Props {
  players: Player[];
  initialTemplates: BoonTemplate[];
  initialActive: PlayerBoon[];
}

const CATEGORY_COLORS: Record<BoonCategory, string> = {
  boon: '#c9a84c',
  inspiration: '#7ac28a',
  luck: '#8ea4d2',
};

const CATEGORY_LABELS: Record<BoonCategory, string> = {
  boon: 'Boon',
  inspiration: 'Inspiration',
  luck: 'Luck',
};

function timeRemaining(boon: PlayerBoon): string | null {
  if (boon.expiry_type !== 'timer') return null;
  const elapsed = (Date.now() / 1000) - boon.started_at;
  const remaining = (boon.expiry_minutes * 60) - elapsed;
  if (remaining <= 0) return 'expired';
  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function BoonsDmClient({ players, initialTemplates, initialActive }: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState<string>(players[0]?.id ?? '');
  const [templates] = useState<BoonTemplate[]>(initialTemplates);
  const [activeBoons, setActiveBoons] = useState<PlayerBoon[]>(initialActive);
  const [expiryType, setExpiryType] = useState<Record<string, string>>({});
  const [timerInputs, setTimerInputs] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick for timers
  useEffect(() => {
    const hasTimers = activeBoons.some(b => b.expiry_type === 'timer');
    if (hasTimers) {
      tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [activeBoons]);

  // Auto-expire timed boons
  useEffect(() => {
    for (const b of activeBoons) {
      const tr = timeRemaining(b);
      if (tr === 'expired') cancelBoon(b.id);
    }
  });

  async function grantBoon(templateId: string) {
    if (!selectedPlayer) return;
    const et = expiryType[templateId] || 'permanent';
    const mins = et === 'timer' ? parseInt(timerInputs[templateId] || '0', 10) : 0;

    const res = await fetch('/api/boons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: templateId,
        player_id: selectedPlayer,
        expiry_type: et,
        expiry_minutes: mins,
      }),
    });
    if (res.ok) {
      // Refresh active boons
      const data = await fetch('/api/boons').then(r => r.json());
      setActiveBoons(data.active);
    }
  }

  async function cancelBoon(id: string) {
    await fetch('/api/boons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'cancel' }),
    });
    setActiveBoons(prev => prev.filter(b => b.id !== id));
  }

  const playerBoons = activeBoons.filter(b => b.player_id === selectedPlayer);

  const adjustTimer = (templateId: string, delta: number) => {
    setTimerInputs(prev => {
      const current = parseInt(prev[templateId] || '0', 10);
      return { ...prev, [templateId]: String(Math.max(0, current + delta)) };
    });
  };

  return (
    <div className="max-w-[1000px] mx-auto px-4 pb-16">
      {/* Return to Session */}
      <div className="flex justify-end pt-3">
        <Link
          href="/dm"
          className="text-[0.65rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors font-sans"
        >
          ← Session
        </Link>
      </div>

      {/* Player selector */}
      <div className="flex justify-center gap-3 flex-wrap py-5">
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedPlayer(p.id)}
            className={`flex flex-col items-center gap-1 cursor-pointer bg-transparent border-none transition-opacity`}
          >
            <div className={`relative w-16 h-16 rounded-full overflow-hidden border-[3px] transition-all ${
              selectedPlayer === p.id
                ? 'border-[var(--color-gold)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            } bg-[#2e2825] flex items-center justify-center`}>
              <span className="text-[1.2rem] text-[var(--color-text-muted)] select-none">{p.initial}</span>
              <Image src={p.img} alt={p.playerName} fill className="object-cover absolute inset-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <span className={`text-[0.65rem] uppercase tracking-[0.1em] ${
              selectedPlayer === p.id ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
            }`}>{p.playerName}</span>
          </button>
        ))}
      </div>

      {/* Section header */}
      <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-gold)] font-sans mb-4 pb-1.5 border-b border-[var(--color-border)]">
        Boon Library
      </div>

      {/* Template cards */}
      <div className="flex flex-col gap-3 mb-8">
        {templates.map(t => {
          const catColor = CATEGORY_COLORS[t.category as BoonCategory];
          const et = expiryType[t.id] || 'permanent';
          return (
            <div key={t.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* Name + category badge */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-serif text-[1.1rem] text-[var(--color-text)]">{t.name}</span>
                    <span className="text-[0.55rem] uppercase tracking-wider font-sans px-1.5 py-0.5 rounded-sm"
                      style={{ color: catColor, border: `1px solid ${catColor}40` }}>
                      {CATEGORY_LABELS[t.category as BoonCategory]}
                    </span>
                    {t.grants_advantage && (
                      <span className="text-[0.55rem] uppercase tracking-wider font-sans px-1.5 py-0.5 rounded-sm text-[#c9a84c] border border-[#c9a84c40]">
                        Advantage
                      </span>
                    )}
                  </div>
                  {/* Description */}
                  <p className="font-serif text-[0.9rem] text-[var(--color-text-body)] leading-relaxed mb-2">{t.description}</p>
                  {/* Spell-like fields */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.72rem] text-[var(--color-text-muted)] font-sans">
                    {t.effect && <span><span className="text-[#6a5a50]">Effect:</span> {t.effect}</span>}
                    {t.action_type && <span><span className="text-[#6a5a50]">Action:</span> {t.action_type}</span>}
                    {t.range && <span><span className="text-[#6a5a50]">Range:</span> {t.range}</span>}
                    {t.duration && <span><span className="text-[#6a5a50]">Duration:</span> {t.duration}</span>}
                  </div>

                  {/* Expiry controls */}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-[0.6rem] uppercase tracking-wider text-[#6a5a50] font-sans">Expiry:</span>
                    {(['permanent', 'long_rest', 'timer'] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-1 cursor-pointer">
                        <div
                          onClick={() => setExpiryType(prev => ({ ...prev, [t.id]: opt }))}
                          className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: et === opt ? '#4a7a5a' : '#5a4f46', backgroundColor: et === opt ? '#4a7a5a' : 'transparent' }}
                        >
                          {et === opt && <span className="text-white text-[0.5rem]">✓</span>}
                        </div>
                        <span className="text-[0.65rem] text-[var(--color-text-muted)] font-sans">
                          {opt === 'permanent' ? 'Until used' : opt === 'long_rest' ? 'Long Rest' : 'Timer'}
                        </span>
                      </label>
                    ))}
                    {et === 'timer' && (
                      <div className="flex items-center gap-1 ml-1">
                        <button onClick={() => adjustTimer(t.id, -1)}
                          className="w-[22px] h-5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm text-[0.85rem] leading-none hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">−</button>
                        <span className="text-[0.9rem] font-serif text-[var(--color-text)] w-6 text-center">{timerInputs[t.id] || '0'}</span>
                        <button onClick={() => adjustTimer(t.id, 1)}
                          className="w-[22px] h-5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm text-[0.85rem] leading-none hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">+</button>
                        <span className="text-[0.6rem] text-[var(--color-text-muted)] font-sans ml-0.5">min</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SEND button */}
                <button
                  onClick={() => grantBoon(t.id)}
                  className="px-4 py-2 bg-white text-[#1a1614] font-sans text-[0.7rem] uppercase tracking-wider rounded-sm hover:bg-[#e8ddd0] transition-colors flex-shrink-0 self-center"
                >
                  Send
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active boons for selected player */}
      <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-gold)] font-sans mb-3 pb-1.5 border-b border-[var(--color-border)]">
        Active Boons — {players.find(p => p.id === selectedPlayer)?.character ?? selectedPlayer}
      </div>

      {playerBoons.length === 0 && (
        <p className="text-[0.85rem] italic text-[var(--color-text-dim)] font-serif">No active boons</p>
      )}

      <div className="flex flex-col gap-2">
        {playerBoons.map(b => {
          const catColor = CATEGORY_COLORS[b.category as BoonCategory];
          const tr = timeRemaining(b);
          return (
            <div key={b.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-[1rem] text-[var(--color-text)]">{b.name}</span>
                  <span className="text-[0.5rem] uppercase tracking-wider font-sans" style={{ color: catColor }}>
                    {CATEGORY_LABELS[b.category as BoonCategory]}
                  </span>
                  {!b.seen && <span className="text-[0.5rem] uppercase tracking-wider text-[#8a7d6e] font-sans">· unseen</span>}
                </div>
                <div className="text-[0.7rem] text-[var(--color-text-muted)] font-sans mt-0.5">
                  {b.expiry_type === 'permanent' && 'Until used'}
                  {b.expiry_type === 'long_rest' && 'Until long rest'}
                  {b.expiry_type === 'timer' && (tr ? `${tr} remaining` : 'Timer')}
                </div>
              </div>
              {/* Cancel button */}
              <button
                onClick={() => cancelBoon(b.id)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#6a5a50] hover:text-[#c05050] hover:bg-[#2e2220] transition-colors text-sm"
                title="Cancel boon"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
