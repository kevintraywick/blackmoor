'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Session, Npc, MenagerieEntry } from '@/lib/types';
import { useAutosave } from '@/lib/useAutosave';
import { resolveImageUrl } from '@/lib/imageUrl';
import { rollDice, diceRange } from '@/lib/dice';
import HpRing from '@/components/HpRing';

// Fields to render in the detail panel — npcs replaced by NPC checkboxes
const FIELDS = [
  { key: 'scenes', label: 'Scene',  rows: 7, placeholder: 'Scene — goal, encounters, locations, beats, traps, treasure, exits…' },
  { key: 'notes',  label: 'Notes',  rows: 7, placeholder: 'Notes — music, atmosphere, misc reminders…' },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

function emptyValues(session: Session): Record<string, string | number> {
  const goal = (session.goal ?? '').trim();
  const scenes = (session.scenes ?? '').trim();
  const combined = goal ? `${goal}\n\n${scenes}` : scenes;
  return {
    title: session.title,
    date:  session.date,
    scenes: combined,
    notes: session.notes ?? '',
    journal: session.journal ?? '',
    journal_public: session.journal_public ?? '',
  };
}

// ── Session Control Bar ──────────────────────────────────────────────────────

function SessionControlBar({
  sessionId,
  session,
  onLongRest,
  onSessionUpdate,
  menagerie: sessionMenagerie,
  allNpcs,
  onSessionsRefresh,
}: {
  sessionId: string;
  session: Session;
  onLongRest: () => void;
  onSessionUpdate: (s: Session) => void;
  menagerie: MenagerieEntry[];
  allNpcs: Npc[];
  onSessionsRefresh: () => void;
}) {
  const [longRestPhase, setLongRestPhase] = useState<'idle' | 'confirm' | 'resting' | 'summary'>('idle');
  const [longRestResult, setLongRestResult] = useState<{ restored_npcs: number; expired_boons: number; cleared_poisons: number } | null>(null);
  const [survivorPhase, setSurvivorPhase] = useState<'idle' | 'confirm' | 'done'>('idle');
  const [survivorChecked, setSurvivorChecked] = useState<boolean[]>([]);

  const isStarted = !!session.started_at;
  const isPaused = !!session.ended_at;
  const isRunning = isStarted && !isPaused;
  // Right button: idle → paused (shows "END SESSION?") → ended (shows stats)
  const [sessionEnded, setSessionEnded] = useState(false);
  // Track if session has been started at least once (after resume, show ✓ instead of START)
  const [hasResumed, setHasResumed] = useState(false);

  // Survivors: alive NPCs in the menagerie
  const survivors = useMemo(() => {
    return sessionMenagerie
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => entry.hp > 0);
  }, [sessionMenagerie]);

  async function handleStart() {
    if (isPaused || sessionEnded) setHasResumed(true);
    setSessionEnded(false);
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    if (res.ok) onSessionUpdate(await res.json());
    // Snapshot player HP so the ring has a stable max
    fetch('/api/players/snapshot-hp', { method: 'POST' }).catch(() => {});
  }

  async function handlePause() {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end' }),
    });
    if (res.ok) onSessionUpdate(await res.json());
  }

  async function handleEndSession() {
    if (survivors.length > 0) {
      // Show survivor confirmation before ending
      setSurvivorChecked(survivors.map(() => true));
      setSurvivorPhase('confirm');
      return;
    }
    await finalizeEnd();
  }

  async function finalizeEnd() {
    setSessionEnded(true);
    setSurvivorPhase('idle');
    // Log a session_end event (pause doesn't log one, only full end does)
    await fetch(`/api/sessions/${sessionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'session_end' }),
    });
  }

  async function handleCarryForward() {
    const checkedIndices = survivors
      .filter((_, i) => survivorChecked[i])
      .map(s => s.idx);
    await finalizeEnd();
    if (checkedIndices.length > 0) {
      await fetch(`/api/sessions/${sessionId}/carry-forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survivors: checkedIndices }),
      });
      onSessionsRefresh();
    }
  }

  function handleLongRestClick() {
    setLongRestPhase('confirm');
  }

  async function executeLongRest() {
    setLongRestPhase('resting');
    const res = await fetch(`/api/sessions/${sessionId}/long-rest`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setLongRestResult(data);
      setLongRestPhase('summary');
      onLongRest();
      // Reset current_hp = max_hp (full heal) for all active players
      fetch('/api/players/snapshot-hp?mode=heal', { method: 'POST' }).catch(() => {});
      setTimeout(() => { setLongRestPhase('idle'); setLongRestResult(null); }, 4000);
    } else {
      setLongRestPhase('idle');
    }
  }

  async function handleRollInitiative() {
    await fetch(`/api/sessions/${sessionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'combat_start' }),
    });
    try { localStorage.setItem('blackmoor-last-session', sessionId); } catch { /* silent */ }
  }

  const circleBase: React.CSSProperties = {
    width: 64, height: 64,
    border: '1px solid rgba(201,168,76,0.4)',
    background: 'transparent',
  };

  // Left button: START → ✓ (running after resume) → RESUME (when paused or ended)
  const startLabel = isRunning && hasResumed ? '✓' : (isPaused || sessionEnded) ? 'RESUME' : 'START';

  // Right button: PAUSE → END SESSION? (when paused) → ended (stats)
  const rightLabel = sessionEnded ? 'ENDED' : isPaused ? 'END\nSESSION?' : 'PAUSE';
  const rightOnClick = sessionEnded ? undefined : isPaused ? handleEndSession : handlePause;

  const buttons = [
    {
      label: startLabel,
      onClick: handleStart,
      style: {
        ...circleBase,
        ...(isRunning ? { borderColor: '#2d8a4e', boxShadow: '0 0 12px rgba(45,138,78,0.6)' } : {}),
      },
      className: isRunning ? 'animate-pulse-slow-green' : '',
      disabled: isRunning,
      isCheck: isRunning && hasResumed,
    },
    {
      label: 'LONG REST',
      onClick: handleLongRestClick,
      style: circleBase,
    },
    {
      label: 'ROLL INIT',
      href: '/dm/initiative?fresh=1',
      onClick: handleRollInitiative,
      style: circleBase,
    },
    {
      label: 'BOON',
      href: '/dm/boons',
      style: circleBase,
    },
    {
      label: rightLabel,
      onClick: rightOnClick,
      style: {
        ...circleBase,
        ...(isPaused && !sessionEnded ? { borderColor: '#c9a84c', boxShadow: '0 0 10px rgba(201,168,76,0.4)' } : {}),
        ...(sessionEnded ? { borderColor: '#a05050', boxShadow: '0 0 12px rgba(160,80,80,0.6)' } : {}),
      },
      className: sessionEnded ? 'animate-pulse-slow-red' : '',
      disabled: sessionEnded,
    },
  ];

  return (
    <div className="flex flex-col items-center gap-2 py-4 border-b border-[var(--color-border)]">
      <style>{`
        @keyframes pulse-slow-green {
          0%, 100% { box-shadow: 0 0 8px rgba(45,138,78,0.4); border-color: #2d8a4e; }
          50% { box-shadow: 0 0 18px rgba(45,138,78,0.7); border-color: #5ab87a; }
        }
        @keyframes pulse-slow-red {
          0%, 100% { box-shadow: 0 0 8px rgba(160,80,80,0.4); border-color: #a05050; }
          50% { box-shadow: 0 0 18px rgba(160,80,80,0.7); border-color: #d06060; }
        }
        .animate-pulse-slow-green { animation: pulse-slow-green 3s ease-in-out infinite; }
        .animate-pulse-slow-red { animation: pulse-slow-red 3s ease-in-out infinite; }
        @keyframes rest-glow {
          0% { opacity: 0; transform: scale(0.9); }
          15% { opacity: 1; transform: scale(1); }
          85% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.95); }
        }
        @keyframes ember-drift {
          0% { opacity: 0; transform: translateY(0) scale(0.5); }
          20% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-30px) scale(0); }
        }
        @keyframes rest-line-in {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .rest-summary-appear { animation: rest-glow 4s ease-in-out forwards; }
        .rest-line { animation: rest-line-in 0.4s ease-out forwards; opacity: 0; }
      `}</style>

      {/* Long Rest Confirmation Overlay */}
      {longRestPhase === 'confirm' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <span className="font-serif text-[1.15rem] text-[var(--color-gold)] tracking-wide">
            Long Rest?
          </span>
          <div className="flex items-center" style={{ gap: 16 }}>
            <button
              onClick={executeLongRest}
              className="rounded-full flex items-center justify-center transition-all hover:scale-105"
              style={{ width: 64, height: 64, background: '#2d5a3f', border: '1px solid rgba(255,255,255,0.7)' }}
            >
              <span className="text-white text-[0.55rem] uppercase tracking-[0.1em] font-sans leading-none text-center px-1">
                Grant Rest
              </span>
            </button>
            <button
              onClick={() => setLongRestPhase('idle')}
              className="rounded-full flex items-center justify-center transition-all hover:scale-105"
              style={{ width: 64, height: 64, background: '#1a1614', border: '1px solid rgba(255,255,255,0.7)' }}
            >
              <span className="text-white text-[0.55rem] uppercase tracking-[0.1em] font-sans leading-none text-center px-1">
                Not Yet
              </span>
            </button>
          </div>
          <span className="text-[0.65rem] text-[var(--color-text-muted)] font-sans uppercase tracking-widest">
            Restores HP &middot; Expires boons &middot; Clears poisons
          </span>
        </div>
      )}

      {/* Resting... */}
      {longRestPhase === 'resting' && (
        <div className="flex items-center gap-3 py-4">
          <span className="font-serif text-[0.9rem] text-[var(--color-text-muted)] animate-pulse">
            Resting&hellip;
          </span>
        </div>
      )}

      {/* Long Rest Summary */}
      {longRestPhase === 'summary' && longRestResult && (
        <div className="rest-summary-appear flex flex-col items-center gap-2 py-3">
          <span className="font-serif text-[1.1rem] text-[var(--color-gold)] tracking-wide">
            Rested
          </span>
          <div className="flex flex-col items-center gap-1">
            {longRestResult.restored_npcs > 0 && (
              <span className="rest-line font-serif text-[0.85rem] text-[#7ac28a]" style={{ animationDelay: '0.2s' }}>
                {longRestResult.restored_npcs} creature{longRestResult.restored_npcs !== 1 ? 's' : ''} healed
              </span>
            )}
            {longRestResult.expired_boons > 0 && (
              <span className="rest-line font-serif text-[0.85rem] text-[#c9a84c]" style={{ animationDelay: '0.5s' }}>
                {longRestResult.expired_boons} boon{longRestResult.expired_boons !== 1 ? 's' : ''} expired
              </span>
            )}
            {longRestResult.cleared_poisons > 0 && (
              <span className="rest-line font-serif text-[0.85rem] text-[#8eb89a]" style={{ animationDelay: '0.8s' }}>
                {longRestResult.cleared_poisons} poison{longRestResult.cleared_poisons !== 1 ? 's' : ''} cleared
              </span>
            )}
            {longRestResult.restored_npcs === 0 && longRestResult.expired_boons === 0 && longRestResult.cleared_poisons === 0 && (
              <span className="rest-line font-serif text-[0.85rem] text-[var(--color-text-muted)]" style={{ animationDelay: '0.2s' }}>
                Nothing to restore
              </span>
            )}
          </div>
        </div>
      )}

      {/* Survivor confirmation — shown when ending session with living NPCs */}
      {survivorPhase === 'confirm' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <span className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-gold)] font-sans">Survivors</span>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {survivors.map(({ entry, idx }, i) => {
              const npc = allNpcs.find(n => n.id === entry.npc_id);
              const imgUrl = npc?.image_path ? resolveImageUrl(npc.image_path) : null;
              const initial = (entry.label || npc?.name || '?').trim()[0].toUpperCase();
              return (
                <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div
                    onClick={() => setSurvivorChecked(prev => prev.map((v, j) => j === i ? !v : v))}
                    style={{
                      width: 20, height: 20, borderRadius: '50%',
                      border: `2px solid ${survivorChecked[i] ? '#4a7a5a' : '#5a4f46'}`,
                      background: survivorChecked[i] ? '#4a7a5a' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', color: '#fff', flexShrink: 0,
                    }}
                  >
                    {survivorChecked[i] && '✓'}
                  </div>
                  <div className="rounded-full overflow-hidden bg-[#1a1714] flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, border: '2px solid #1a1a1a' }}>
                    {imgUrl
                      ? <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs text-[var(--color-text-muted)] font-serif">{initial}</span>}
                  </div>
                  <span className="font-serif text-sm text-[var(--color-text)] truncate">{entry.label || npc?.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)] font-serif ml-auto tabular-nums">{entry.hp}/{entry.maxHp ?? entry.hp}</span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center" style={{ gap: 16, marginTop: 4 }}>
            <button
              onClick={handleCarryForward}
              className="rounded-full flex items-center justify-center transition-all hover:scale-105"
              style={{ width: 64, height: 64, background: '#2d5a3f', border: '1px solid rgba(255,255,255,0.7)' }}
            >
              <span className="text-white text-[0.5rem] uppercase tracking-[0.1em] font-sans leading-tight text-center px-1 whitespace-pre-line">Carry\nForward</span>
            </button>
            <button
              onClick={() => { setSurvivorPhase('idle'); finalizeEnd(); }}
              className="rounded-full flex items-center justify-center transition-all hover:scale-105"
              style={{ width: 64, height: 64, background: '#1a1614', border: '1px solid rgba(255,255,255,0.7)' }}
            >
              <span className="text-white text-[0.5rem] uppercase tracking-[0.1em] font-sans leading-tight text-center px-1 whitespace-pre-line">End\nWithout</span>
            </button>
          </div>
        </div>
      )}

      {/* Control circles — hidden during long rest or survivor flow */}
      {longRestPhase === 'idle' && survivorPhase === 'idle' && (
        <div className="flex items-center" style={{ gap: 16 }}>
          {buttons.map(btn => {
            const circle = (
              <button
                key={btn.label}
                onClick={btn.onClick}
                disabled={btn.disabled}
                className={`rounded-full flex items-center justify-center transition-all hover:scale-105 relative ${btn.className ?? ''}`}
                style={btn.style}
                title={btn.label}
              >
                <span className={`uppercase tracking-[0.1em] font-sans leading-tight text-center px-1 whitespace-pre-line ${
                  btn.isCheck ? 'text-[#5ab87a] text-xl' : 'text-white text-[0.55rem]'
                }`}>
                  {btn.label}
                </span>
              </button>
            );

            if (btn.href) {
              return (
                <Link key={btn.label} href={btn.href} onClick={btn.onClick}>
                  {circle}
                </Link>
              );
            }
            return circle;
          })}
        </div>
      )}
    </div>
  );
}

function NpcStatCard({
  npc,
  entry,
  menagerieIdx,
  onRemove,
  onUpdateHp,
  onClose,
}: {
  npc: Npc;
  entry: MenagerieEntry;
  menagerieIdx: number;
  onRemove: (npcId: string, menagerieIndex: number) => void;
  onUpdateHp: (menagerieIdx: number, delta: number) => void;
  onClose: () => void;
}) {
  const isDead = entry.hp <= 0;
  const maxHp = entry.maxHp ?? entry.hp;
  // Instance data with template fallback for old entries
  const cr = entry.cr ?? npc.cr;
  const ac = entry.ac ?? npc.ac;
  const speed = entry.speed ?? npc.speed;
  const attacks = entry.attacks ?? npc.attacks;
  const traits = entry.traits ?? npc.traits;
  const actions = entry.actions ?? npc.actions;
  const notes = entry.notes ?? npc.notes;
  const gold = entry.gold ?? npc.gold;
  const equipment = entry.equipment ?? npc.equipment;
  const treasure = entry.treasure ?? npc.treasure;
  const hpRange = npc.hp_roll ? diceRange(npc.hp_roll) : null;

  const imgUrl = npc.image_path ? resolveImageUrl(npc.image_path) : null;
  const initial = (npc.name?.trim()?.[0] ?? '?').toUpperCase();

  function StatDisplay({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-gold)]">{label}</span>
        <span className="font-serif text-lg font-bold text-[var(--color-text)] pb-0.5 border-b border-[var(--color-border)]">{value || '—'}</span>
      </div>
    );
  }

  function TextSection({ label, content, placeholder }: { label: string; content: string; placeholder: string }) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-3">
        <div className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-gold)] mb-1.5">{label}</div>
        <p className="font-serif text-[0.95rem] text-[var(--color-text)] whitespace-pre-wrap m-0 leading-relaxed min-h-[3rem]">
          {content || <span className="text-[var(--color-text-dim)] italic">{placeholder}</span>}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header: portrait + name + close */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-4 mb-3">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 64, height: 64, flexShrink: 0, opacity: isDead ? 0.5 : 1, filter: isDead ? 'grayscale(0.7)' : 'none' }}>
            <HpRing current={entry.hp} max={maxHp}>
              <div className="rounded-full overflow-hidden bg-[#1a1714] flex items-center justify-center w-full h-full"
                style={{ border: isDead ? '2px solid #5a3030' : '2px solid #1a1a1a' }}>
                {imgUrl
                  ? <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover" />
                  : <span className="text-lg text-[var(--color-text-muted)] font-serif">{initial}</span>}
              </div>
            </HpRing>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-serif text-2xl text-[var(--color-text)] font-bold">{entry.label || npc.name}</div>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg self-start" title="Close">✕</button>
        </div>
      </div>

      {/* Stats row */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-3 mb-3">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <StatDisplay label="CR" value={cr} />
          <StatDisplay label="AC" value={ac} />
          <StatDisplay label="Speed" value={speed} />
          <StatDisplay label="HP Roll" value={hpRange ? `${npc.hp_roll}` : ''} />
          <StatDisplay label="HP Range" value={hpRange ? `${hpRange.min}–${hpRange.max}` : ''} />
          {/* Gold with +/- */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-gold)]">Gold</span>
            <span className="font-serif text-lg font-bold text-[var(--color-text)] pb-0.5 border-b border-[var(--color-border)]">{gold || '0'}</span>
          </div>
          {/* HP with +/- controls */}
          <div className="flex flex-col items-center gap-0.5 ml-auto">
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-gold)]">HP</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => onUpdateHp(menagerieIdx, -1)}
                className="rounded-sm transition-colors hover:border-[var(--color-gold)]"
                style={{ width: 22, height: 20, background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}
              >−</button>
              <span className={`font-serif text-lg font-bold tabular-nums ${isDead ? 'text-[#5a3030]' : entry.hp < maxHp ? 'text-[#c07050]' : 'text-[#4a8a65]'}`}>
                {entry.hp}/{maxHp}
              </span>
              <button
                onClick={() => onUpdateHp(menagerieIdx, 1)}
                className="rounded-sm transition-colors hover:border-[var(--color-gold)]"
                style={{ width: 22, height: 20, background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}
              >+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Text sections — 2-column grid matching NPC page */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <TextSection label="Attacks" content={attacks} placeholder="Attack names, bonuses, damage..." />
        <TextSection label="Actions" content={actions} placeholder="Bonus actions, reactions, legendary actions..." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <TextSection label="Loot" content={treasure} placeholder="Loot, valuables, magic items..." />
        <TextSection label="Equipment" content={equipment} placeholder="Weapons, armor, gear carried..." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <TextSection label="Traits & Abilities" content={traits} placeholder="Passive traits, resistances, immunities..." />
        <TextSection label="Notes" content={notes} placeholder="Tactics, lore, encounter notes..." />
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(npc.id, menagerieIdx)}
        className="w-full py-1.5 rounded text-[0.75rem] font-serif transition-colors"
        style={{ background: '#3a2020', color: '#a05050', border: '1px solid #5a3030' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#8b1a1a'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#3a2020'; e.currentTarget.style.color = '#a05050'; }}
      >
        Remove from Session
      </button>
    </div>
  );
}

function NpcCastingBoard({
  allNpcs,
  npcIds,
  menagerie,
  onRemoveInstance,
  onUpdateHp,
}: {
  allNpcs: Npc[];
  npcIds: string[];
  menagerie: MenagerieEntry[];
  onRemoveInstance: (npcId: string, menagerieIndex: number) => void;
  onUpdateHp: (menagerieIdx: number, delta: number) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Build instance list from npcIds + menagerie (positional match)
  const instances = useMemo(() => {
    const result: { npc: Npc; entry: MenagerieEntry; menagerieIdx: number }[] = [];
    const counters: Record<string, number> = {};
    for (let i = 0; i < npcIds.length; i++) {
      const npcId = npcIds[i];
      const npc = allNpcs.find(n => n.id === npcId);
      if (!npc) continue;
      counters[npcId] = (counters[npcId] ?? 0);
      // Find the nth menagerie entry for this npc_id
      let found = 0;
      for (let j = 0; j < menagerie.length; j++) {
        if (menagerie[j].npc_id === npcId) {
          if (found === counters[npcId]) {
            result.push({ npc, entry: menagerie[j], menagerieIdx: j });
            break;
          }
          found++;
        }
      }
      counters[npcId]++;
    }
    return result;
  }, [allNpcs, npcIds, menagerie]);

  // Clear selection if the selected instance was removed
  const selected = selectedIdx !== null ? instances[selectedIdx] : null;

  return (
    <div className="mb-7">
      {/* NPC circles row */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-3 mb-3">
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-2">NPCs in this Session</div>
        {instances.length === 0 ? (
          <p className="text-[#5a4a44] text-xs font-serif italic">Add NPCs from the NPCs page.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {instances.map(({ npc, entry, menagerieIdx }, idx) => {
              const isDead = entry.hp <= 0;
              const imgUrl = npc.image_path ? resolveImageUrl(npc.image_path) : null;
              const initial = npc.name?.trim()?.[0]?.toUpperCase() ?? '?';
              const isSelected = selectedIdx === idx;
              return (
                <button
                  key={`${npc.id}-${idx}`}
                  onClick={() => setSelectedIdx(isSelected ? null : idx)}
                  className="flex flex-col items-center gap-1 relative cursor-pointer bg-transparent border-none"
                >
                  <div style={{
                    width: 72, height: 72,
                    opacity: isDead ? 0.5 : 1,
                    filter: isDead ? 'grayscale(0.7)' : 'none',
                    outline: isSelected ? '2px solid var(--color-gold)' : 'none',
                    outlineOffset: 2,
                    borderRadius: '50%',
                  }}>
                    <HpRing current={entry.hp} max={entry.maxHp ?? entry.hp}>
                      <div
                        className="rounded-full overflow-hidden bg-[#1a1714] flex items-center justify-center relative w-full h-full"
                        style={{ border: isDead ? '2px solid #5a3030' : '2px solid #1a1a1a' }}
                      >
                        {imgUrl
                          ? <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover" />
                          : <span className="text-sm text-[var(--color-text-muted)] font-serif">{initial}</span>
                        }
                        {isDead && (
                          <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem',
                          }}>
                            ☠
                          </div>
                        )}
                      </div>
                    </HpRing>
                  </div>
                  <span className={`font-serif text-[0.75rem] max-w-[76px] truncate text-center ${isDead ? 'line-through text-[#5a3030]' : isSelected ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'}`}>
                    {entry.label || npc.name}
                  </span>
                  {entry.maxHp !== undefined && (
                    <span className={`text-[0.72rem] font-serif tabular-nums ${isDead ? 'text-[#5a3030]' : entry.hp < entry.maxHp ? 'text-[#c07050]' : 'text-[#4a8a65]'}`}>
                      {entry.hp}/{entry.maxHp}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-width NPC Stat Card below circles */}
      {selected && (
        <NpcStatCard
          npc={selected.npc}
          entry={selected.entry}
          menagerieIdx={selected.menagerieIdx}
          onRemove={(npcId, mIdx) => { setSelectedIdx(null); onRemoveInstance(npcId, mIdx); }}
          onUpdateHp={onUpdateHp}
          onClose={() => setSelectedIdx(null)}
        />
      )}
    </div>
  );
}

export default function DmSessionsClient({
  initial,
  allNpcs,
}: {
  initial: Session[];
  allNpcs: Npc[];
}) {
  const [sessions, setSessions] = useState<Session[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.length > 0 ? initial[0].id : null
  );
  const [values, setValues] = useState<Record<string, string | number>>(
    initial.length > 0 ? emptyValues(initial[0]) : {}
  );
  const [npcIds, setNpcIds] = useState<string[]>(
    initial.length > 0 ? (Array.isArray(initial[0].npc_ids) ? initial[0].npc_ids : []) : []
  );
  const [menagerie, setMenagerie] = useState<MenagerieEntry[]>(
    initial.length > 0 ? (Array.isArray(initial[0].menagerie) ? initial[0].menagerie : []) : []
  );
  const { save: autosave, status: saveStatus } = useAutosave(() => `/api/sessions/${selectedId}`);
  const creating = useRef(false);

  // Session stats (players, boons, poisons, killed)
  const [sessionStats, setSessionStats] = useState<{
    players: string[];
    boons: { name: string; player: string }[];
    poisons: { type: string; player: string }[];
    killed: string[];
  } | null>(null);

  useEffect(() => {
    if (!selectedId) { setSessionStats(null); return; }
    fetch(`/api/sessions/${selectedId}/stats`).then(r => r.json()).then(setSessionStats).catch(() => setSessionStats(null));
  }, [selectedId]);

  const selected = sessions.find(s => s.id === selectedId) ?? null;

  function handleSelect(session: Session) {
    setSelectedId(session.id);
    setValues(emptyValues(session));
    setNpcIds(Array.isArray(session.npc_ids) ? session.npc_ids : []);
    setMenagerie(Array.isArray(session.menagerie) ? session.menagerie : []);
    try { localStorage.setItem('blackmoor-last-session', session.id); } catch { /* silent */ }
  }

  function handleChange(key: string, value: string | number) {
    if (!selectedId) return;
    const updated = { ...values, [key]: value };
    setValues(updated);
    autosave({ [key]: value });
    if (key === 'title' || key === 'date') {
      setSessions(prev => prev.map(s =>
        s.id === selectedId ? { ...s, [key]: value as string } : s
      ));
    }
  }

  const handleAddNpcInstance = useCallback((npcId: string) => {
    if (!selectedId) return;
    const npc = allNpcs.find(n => n.id === npcId);
    if (!npc) return;

    // Find highest label number used for this template in current menagerie
    let maxLabel = 0;
    for (const e of menagerie) {
      if (e.npc_id === npcId && e.label) {
        const m = e.label.match(/(\d+)$/);
        if (m) maxLabel = Math.max(maxLabel, parseInt(m[1], 10));
      }
    }
    const instanceNum = maxLabel + 1;
    const label = `${npc.name} ${instanceNum}`;

    // Roll HP from template
    const rolled = npc.hp_roll ? rollDice(npc.hp_roll) : (parseInt(npc.hp, 10) || 1);
    const hp = rolled ?? 1;

    const entry: MenagerieEntry = {
      npc_id: npcId, hp, maxHp: hp, label,
      species: npc.species, cr: npc.cr, ac: npc.ac, speed: npc.speed,
      attacks: npc.attacks, traits: npc.traits, actions: npc.actions,
      notes: npc.notes, gold: npc.gold, equipment: npc.equipment, treasure: npc.treasure,
    };
    const nextIds = [...npcIds, npcId];
    const nextMenagerie = [...menagerie, entry];

    setNpcIds(nextIds);
    setMenagerie(nextMenagerie);
    autosave({ npc_ids: nextIds, menagerie: nextMenagerie });
    setSessions(prev => prev.map(s =>
      s.id === selectedId ? { ...s, npc_ids: nextIds, menagerie: nextMenagerie } : s
    ));
  }, [selectedId, allNpcs, npcIds, menagerie, autosave, setSessions]);

  const handleRemoveNpcInstance = useCallback((npcId: string, menagerieIdx: number) => {
    if (!selectedId) return;

    // Find which npcIds index corresponds to this menagerie entry
    // Count through npcIds entries matching npcId until we find the one at this menagerie position
    let targetNpcIdxCount = 0;
    for (let j = 0; j < menagerie.length; j++) {
      if (menagerie[j].npc_id === npcId) {
        if (j === menagerieIdx) break;
        targetNpcIdxCount++;
      }
    }
    // Find that nth occurrence in npcIds
    let npcIdxToRemove = -1;
    let count = 0;
    for (let i = 0; i < npcIds.length; i++) {
      if (npcIds[i] === npcId) {
        if (count === targetNpcIdxCount) { npcIdxToRemove = i; break; }
        count++;
      }
    }

    const nextIds = npcIds.filter((_, i) => i !== npcIdxToRemove);
    const nextMenagerie = menagerie.filter((_, i) => i !== menagerieIdx);

    setNpcIds(nextIds);
    setMenagerie(nextMenagerie);
    autosave({ npc_ids: nextIds, menagerie: nextMenagerie });
    setSessions(prev => prev.map(s =>
      s.id === selectedId ? { ...s, npc_ids: nextIds, menagerie: nextMenagerie } : s
    ));
  }, [selectedId, npcIds, menagerie, autosave, setSessions]);

  const handleUpdateNpcHp = useCallback((menagerieIdx: number, delta: number) => {
    if (!selectedId) return;
    const entry = menagerie[menagerieIdx];
    if (!entry) return;
    const maxHp = entry.maxHp ?? entry.hp;
    const newHp = Math.max(0, Math.min(maxHp, entry.hp + delta));
    if (newHp === entry.hp) return;
    const nextMenagerie = menagerie.map((e, i) => i === menagerieIdx ? { ...e, hp: newHp } : e);
    setMenagerie(nextMenagerie);
    autosave({ menagerie: nextMenagerie });
    setSessions(prev => prev.map(s =>
      s.id === selectedId ? { ...s, menagerie: nextMenagerie } : s
    ));
  }, [selectedId, menagerie, autosave, setSessions]);

  async function handleNew() {
    if (creating.current) return;
    creating.current = true;
    try {
      const maxNum = sessions.reduce((m, s) => Math.max(m, s.number), 0);
      const id = Date.now().toString(36);
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, number: maxNum + 1 }),
      });
      if (!res.ok) { console.error('Failed to create session'); return; }
      const session: Session = await res.json();
      setSessions(prev => [...prev, session]);
      handleSelect(session);
    } finally {
      creating.current = false;
    }
  }

  const statusText = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed' }[saveStatus];
  const statusColor = {
    idle: '',
    saving: 'text-[var(--color-text-muted)]',
    saved: 'text-[#5a8a5a]',
    failed: 'text-[#c0392b]',
  }[saveStatus];

  return (
    <div>
      {/* Session box row */}
      <div className="border-b border-[var(--color-border)] bg-[#1e1b18] px-6 py-4">
        <div className="max-w-[1000px] mx-auto flex gap-2.5 overflow-x-auto pb-1">
          {sessions.map(s => {
            const isSelected = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => handleSelect(s)}
                className={`flex-shrink-0 rounded px-3 py-1.5 font-serif text-[13px] leading-snug transition-colors border whitespace-nowrap ${
                  isSelected
                    ? 'border-[var(--color-gold)] bg-[var(--color-surface)] text-[var(--color-gold)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:border-[#5a4a44]'
                }`}
              >
                {s.number}. {s.title || 'Untitled'}
              </button>
            );
          })}

          {/* + button */}
          <button
            onClick={handleNew}
            className="flex-shrink-0 rounded border border-dashed border-[var(--color-border)] bg-transparent px-3 py-1.5 font-serif text-[13px] text-[var(--color-gold)] hover:border-[#5a4a44] transition-colors"
            title="New session"
          >
            +
          </button>
        </div>
      </div>

      {/* Session Control Bar */}
      {selected && (
        <div className="bg-[#1e1b18] px-6">
          <div className="max-w-[1000px] mx-auto">
            <SessionControlBar
              sessionId={selected.id}
              session={selected}
              menagerie={menagerie}
              allNpcs={allNpcs}
              onLongRest={async () => {
                // Refresh menagerie from server after omnibus long rest
                try {
                  const fresh = await fetch(`/api/sessions/${selected.id}`).then(r => r.json());
                  if (fresh?.menagerie) {
                    const m = Array.isArray(fresh.menagerie) ? fresh.menagerie : [];
                    setMenagerie(m);
                    setSessions(prev => prev.map(s => s.id === selected.id ? { ...s, menagerie: m } : s));
                  }
                } catch { /* silent */ }
              }}
              onSessionUpdate={(updated) => {
                setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
              }}
              onSessionsRefresh={async () => {
                // Reload all sessions after carry-forward creates/updates next session
                try {
                  const res = await fetch('/api/sessions');
                  if (res.ok) {
                    const all = await res.json();
                    setSessions(all);
                  }
                } catch { /* silent */ }
              }}
            />
          </div>
        </div>
      )}

      {/* Session detail panel */}
      <div className="px-8 py-8 max-w-[1000px] mx-auto">
        {!selected ? (
          <p className="text-[#5a4a44] font-serif italic text-sm">
            No sessions yet — click + to create your first one.
          </p>
        ) : (
          <div>
            {/* Scene + Locations side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7 items-start">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <textarea
                    rows={f.rows}
                    value={values[f.key as FieldKey] as string}
                    placeholder={f.placeholder}
                    onChange={e => handleChange(f.key, e.target.value)}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[var(--color-gold)] placeholder:text-[var(--color-text-muted)] font-serif"
                  />
                </div>
              ))}
            </div>


            {/* NPC Casting Board */}
            <NpcCastingBoard
              allNpcs={allNpcs}
              npcIds={npcIds}
              menagerie={menagerie}
              onRemoveInstance={handleRemoveNpcInstance}
              onUpdateHp={handleUpdateNpcHp}
            />

            {/* Journal — Private | Public side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Journal — Private</div>
                <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2">
                  {/* Session stats */}
                  {sessionStats && (sessionStats.players.length > 0 || sessionStats.boons.length > 0 || sessionStats.poisons.length > 0 || sessionStats.killed.length > 0) && (
                    <div className="text-[0.8rem] font-serif text-[var(--color-text-muted)] mb-2 space-y-0.5">
                      {sessionStats.players.length > 0 && (
                        <div><span className="text-[var(--color-gold)]">Players:</span> {sessionStats.players.join(', ')}</div>
                      )}
                      {sessionStats.boons.length > 0 && (
                        <div><span className="text-[var(--color-gold)]">Boons:</span> {sessionStats.boons.map(b => `${b.name} → ${b.player}`).join(', ')}</div>
                      )}
                      {sessionStats.poisons.length > 0 && (
                        <div><span className="text-[var(--color-gold)]">Poisons:</span> {sessionStats.poisons.map(p => `${p.type} → ${p.player}`).join(', ')}</div>
                      )}
                      {sessionStats.killed.length > 0 && (
                        <div><span className="text-[var(--color-gold)]">Killed:</span> {sessionStats.killed.join(', ')}</div>
                      )}
                    </div>
                  )}
                  <textarea
                    rows={6}
                    value={values.journal as string}
                    onChange={e => handleChange('journal', e.target.value)}
                    className="w-full bg-transparent text-[var(--color-text)] text-[0.95rem] leading-relaxed resize-y outline-none font-serif"
                  />
                </div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Journal — Public</div>
                <textarea
                  rows={6}
                  value={values.journal_public as string}
                  placeholder="What players see on the Journey page…"
                  onChange={e => handleChange('journal_public', e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[var(--color-gold)] placeholder:text-[var(--color-text-muted)] font-serif"
                />
              </div>
            </div>

            {/* Save status */}
            <div className={`text-xs text-right mt-2 h-4 transition-opacity duration-200 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'} ${statusColor}`}>
              {statusText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
