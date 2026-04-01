'use client';

import { useState, useRef, useMemo } from 'react';
import type { Session, Npc, MenagerieEntry } from '@/lib/types';
import { useAutosave } from '@/lib/useAutosave';
import { resolveImageUrl } from '@/lib/imageUrl';

// Fields to render in the detail panel — npcs replaced by NPC checkboxes
const FIELDS = [
  { key: 'scenes',    label: 'Scene',     rows: 10, placeholder: 'Goal, encounters, beats, traps, treasure, exits…',  cols: 2 },
  { key: 'locations', label: 'Locations', rows: 10, placeholder: 'Key locations and descriptions…',                   cols: 2 },
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
    locations: session.locations ?? '',
    notes: session.notes ?? '',
  };
}

function NpcCastingBoard({
  allNpcs,
  npcIds,
  sessions,
  currentSessionId,
  onAdd,
}: {
  allNpcs: Npc[];
  npcIds: string[];
  sessions: Session[];
  currentSessionId: string | null;
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
    const sz = opts.size ?? 58;
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
        <span className="font-serif text-[0.75rem] text-[var(--color-text-muted)] max-w-[70px] truncate text-center">
          {npc.name || 'Unnamed'}
        </span>
      </button>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7 items-start">
      {/* Left: NPCs in this Session */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-3">
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-2">NPCs in this Session</div>
        {assignedNpcs.length === 0 ? (
          <p className="text-[#5a4a44] text-xs font-serif italic">No NPCs assigned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {assignedNpcs.map(npc => renderNpcCircle(npc, { onClick: () => {} }))}
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

  function handleLongRest() {
    if (!selectedId || menagerie.length === 0) return;
    if (!confirm('Grant a Long Rest? This will restore all NPCs to full HP.')) return;
    const restored = menagerie.map(e => ({ ...e, hp: e.maxHp ?? e.hp }));
    setMenagerie(restored);
    autosave({ menagerie: restored });
    setSessions(prev => prev.map(s =>
      s.id === selectedId ? { ...s, menagerie: restored } : s
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
                  <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">{f.label}</div>
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
              onAdd={handleNpcToggle}
            />

            {/* Menagerie HP summary + Long Rest */}
            {menagerie.length > 0 && menagerie.some(e => e.maxHp !== undefined) && (
              <div className="mb-7">
                <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-2">NPC Hit Points</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {menagerie.map((entry, idx) => {
                    const isDamaged = entry.maxHp !== undefined && entry.hp < entry.maxHp;
                    const isDead = entry.hp <= 0;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-serif ${
                          isDead
                            ? 'border-[#6a1a1a]/40 bg-[#241414] opacity-50'
                            : isDamaged
                              ? 'border-[#6a1a1a]/40 bg-[#2e1a1a]'
                              : 'border-[#2d5a3f]/40 bg-[#1a2520]'
                        }`}
                      >
                        <span className="text-[var(--color-text)]">{entry.label || 'NPC'}</span>
                        <span className={`tabular-nums ${isDead ? 'text-[#a05050]' : isDamaged ? 'text-[#c07050]' : 'text-[#4a8a65]'}`}>
                          {entry.hp}/{entry.maxHp}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleLongRest}
                  className="text-[0.7rem] uppercase tracking-[0.15em] text-[#4a8a65] border border-[#2d5a3f]
                             rounded px-4 py-2 hover:bg-[#1a2a1a] hover:border-[#4a8a65] transition-colors font-serif"
                >
                  Long Rest
                </button>
              </div>
            )}

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
