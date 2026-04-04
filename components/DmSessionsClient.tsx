'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import Link from 'next/link';
import type { Session, Npc, MenagerieEntry } from '@/lib/types';
import { useAutosave } from '@/lib/useAutosave';
import { resolveImageUrl } from '@/lib/imageUrl';

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
}: {
  sessionId: string;
  session: Session;
  onLongRest: () => void;
  onSessionUpdate: (s: Session) => void;
}) {
  const [longRestPhase, setLongRestPhase] = useState<'idle' | 'confirm' | 'resting' | 'summary'>('idle');
  const [longRestResult, setLongRestResult] = useState<{ restored_npcs: number; expired_boons: number; cleared_poisons: number } | null>(null);


  const isStarted = !!session.started_at;
  const isPaused = !!session.ended_at;
  const isRunning = isStarted && !isPaused;
  // Right button: idle → paused (shows "END SESSION?") → ended (shows stats)
  const [sessionEnded, setSessionEnded] = useState(false);
  // Track if session has been started at least once (after resume, show ✓ instead of START)
  const [hasResumed, setHasResumed] = useState(false);

  async function handleStart() {
    if (isPaused || sessionEnded) setHasResumed(true);
    setSessionEnded(false);
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    if (res.ok) onSessionUpdate(await res.json());
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
    setSessionEnded(true);
    // Log a session_end event (pause doesn't log one, only full end does)
    await fetch(`/api/sessions/${sessionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'session_end' }),
    });
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

      {/* Control circles — hidden during long rest flow */}
      {longRestPhase === 'idle' && (
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

function NpcCastingBoard({
  allNpcs,
  npcIds,
  sessions,
  currentSessionId,
  menagerie,
  onAdd,
}: {
  allNpcs: Npc[];
  npcIds: string[];
  sessions: Session[];
  currentSessionId: string | null;
  menagerie: MenagerieEntry[];
  onAdd: (id: string) => void;
}) {
  const [selectedCatalogNpc, setSelectedCatalogNpc] = useState<string | null>(null);

  // NPCs assigned to OTHER sessions
  const assignedElsewhere = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (s.id === currentSessionId) continue;
      const ids = Array.isArray(s.npc_ids) ? s.npc_ids : [];
      ids.forEach(id => set.add(id));
    }
    return set;
  }, [sessions, currentSessionId]);

  // Unassigned = not in this session AND not in any other session
  const unassigned = useMemo(() => {
    return allNpcs.filter(n => !npcIds.includes(n.id) && !assignedElsewhere.has(n.id));
  }, [allNpcs, npcIds, assignedElsewhere]);

  const assignedNpcs = npcIds.map(id => allNpcs.find(n => n.id === id)).filter(Boolean) as Npc[];

  function handleConfirmAdd() {
    if (!selectedCatalogNpc) return;
    onAdd(selectedCatalogNpc);
    setSelectedCatalogNpc(null);
  }

  function renderNpcCircle(npc: Npc, opts: { selected?: boolean; onClick: () => void; size?: number }) {
    const imgUrl = npc.image_path ? resolveImageUrl(npc.image_path) : null;
    const initial = npc.name?.trim()?.[0]?.toUpperCase() ?? '?';
    const sz = opts.size ?? 64;
    return (
      <button
        key={npc.id}
        onClick={opts.onClick}
        className="flex flex-col items-center gap-1 transition-opacity"
        title={npc.name}
      >
        <div
          className="rounded-full overflow-hidden bg-[#1a1714] flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            width: sz, height: sz,
            border: opts.selected ? '3px solid #2d8a4e' : '2px solid rgba(201,168,76,0.4)',
            boxShadow: opts.selected ? '0 0 8px rgba(45,138,78,0.5)' : 'none',
          }}
        >
          {imgUrl
            ? <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover" />
            : <span className="text-sm text-[var(--color-text-muted)] font-serif">{initial}</span>
          }
        </div>
        <span className="font-serif text-[0.87rem] text-[var(--color-text-muted)] max-w-[76px] truncate text-center">
          {npc.name || 'Unnamed'}
        </span>
      </button>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7 items-stretch">
      {/* Left: NPCs in this Session */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-3">
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-2">NPCs in this Session</div>
        {assignedNpcs.length === 0 ? (
          <p className="text-[#5a4a44] text-xs font-serif italic">No NPCs assigned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {assignedNpcs.map((npc, idx) => {
              const entry = menagerie.find((e, i) => {
                // Match nth occurrence of this npc_id
                let count = 0;
                for (let j = 0; j < npcIds.length; j++) {
                  if (npcIds[j] === npc.id) {
                    if (j === idx) return e.npc_id === npc.id && count === 0;
                    if (npcIds[j] === npc.id) count++;
                  }
                }
                return false;
              }) ?? menagerie.find(e => e.npc_id === npc.id);
              return (
                <div key={`${npc.id}-${idx}`} className="flex flex-col items-center gap-1">
                  {renderNpcCircle(npc, { onClick: () => {} })}
                  {entry && entry.maxHp !== undefined && (
                    <span className={`text-[0.72rem] font-serif tabular-nums ${entry.hp <= 0 ? 'text-[#a05050]' : entry.hp < entry.maxHp ? 'text-[#c07050]' : 'text-[#4a8a65]'}`}>
                      {entry.hp}/{entry.maxHp}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: NPC Catalog */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-3">
        <div className="flex items-center justify-between mb-2">
          {selectedCatalogNpc ? (
            <button
              onClick={handleConfirmAdd}
              className="flex items-center gap-1 text-[#2d8a4e] hover:text-[#5ab87a] transition-colors"
              title="Add to session"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M10 3L5 8l5 5" />
              </svg>
              <span className="text-[0.7rem] uppercase tracking-[0.15em] font-sans">Add to Session</span>
            </button>
          ) : (
            <span className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">+ Add NPCs</span>
          )}
        </div>
        {unassigned.length === 0 ? (
          <p className="text-[#5a4a44] text-xs font-serif italic">All NPCs are assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {unassigned.map(npc => renderNpcCircle(npc, {
              selected: selectedCatalogNpc === npc.id,
              onClick: () => setSelectedCatalogNpc(prev => prev === npc.id ? null : npc.id),
            }))}
          </div>
        )}
      </div>
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

  function handleNpcToggle(npcId: string) {
    if (!selectedId) return;
    const next = npcIds.includes(npcId)
      ? npcIds.filter(id => id !== npcId)
      : [...npcIds, npcId];
    setNpcIds(next);
    autosave({ npc_ids: next });
    setSessions(prev => prev.map(s =>
      s.id === selectedId ? { ...s, npc_ids: next } : s
    ));
  }

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
                className={`flex-shrink-0 w-[96px] rounded px-2 py-2.5 flex flex-col items-center gap-1 text-left transition-colors border ${
                  isSelected
                    ? 'border-[var(--color-gold)] bg-[var(--color-surface)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[#5a4a44]'
                }`}
              >
                <span className="text-lg font-bold leading-none font-serif text-[var(--color-gold)]">
                  #{s.number}
                </span>
                <span className={`text-[13px] font-serif leading-tight line-clamp-2 text-center w-full ${isSelected ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'}`}>
                  {s.title || 'Untitled'}
                </span>
                {s.date && (
                  <span className="text-[8px] text-[var(--color-border)]">{s.date}</span>
                )}
              </button>
            );
          })}

          {/* + box */}
          <button
            onClick={handleNew}
            className="flex-shrink-0 w-[88px] rounded border border-dashed border-[var(--color-border)] bg-transparent flex items-center justify-center text-lg font-bold font-serif text-[var(--color-gold)] hover:border-[#5a4a44] transition-colors"
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
              sessions={sessions}
              currentSessionId={selectedId}
              menagerie={menagerie}
              onAdd={handleNpcToggle}
            />

            {/* Journal — Private | Public side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Journal — Private</div>
                <textarea
                  rows={6}
                  value={values.journal as string}
                  placeholder="DM-only notes — what happened, what surprised you…"
                  onChange={e => handleChange('journal', e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[var(--color-gold)] placeholder:text-[var(--color-text-muted)] font-serif"
                />
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
