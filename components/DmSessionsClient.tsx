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
  onToggle,
}: {
  allNpcs: Npc[];
  npcIds: string[];
  onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [showAvailable, setShowAvailable] = useState(false);

  // Count assigned NPCs (supports duplicates)
  const counts: Record<string, number> = {};
  npcIds.forEach(id => { counts[id] = (counts[id] ?? 0) + 1; });
  const assignedEntries = Object.entries(counts);

  // Filter available NPCs by search
  const query = search.trim().toLowerCase();
  const available = useMemo(() => {
    if (!query) return allNpcs;
    return allNpcs.filter(n => n.name?.toLowerCase().includes(query));
  }, [allNpcs, query]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7 items-start">
      {/* Left: NPCs in this Session */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-3">
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-2">NPCs in this Session</div>
        {assignedEntries.length === 0 ? (
          <p className="text-[#5a4a44] text-xs font-serif italic">No NPCs assigned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {assignedEntries.map(([npcId, count]) => {
              const npc = allNpcs.find(n => n.id === npcId);
              if (!npc) return null;
              const imgUrl = npc.image_path ? resolveImageUrl(npc.image_path) : null;
              const initial = npc.name?.trim()?.[0]?.toUpperCase() ?? '?';
              return (
                <button
                  key={npcId}
                  onClick={() => onToggle(npcId)}
                  className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity group"
                  title={`Remove ${npc.name}`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[#1a1714] border-2 border-[var(--color-gold)]/40 group-hover:border-[#a05050] flex items-center justify-center flex-shrink-0 transition-colors">
                    {imgUrl
                      ? <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover" />
                      : <span className="text-sm text-[var(--color-text-muted)] font-serif">{initial}</span>
                    }
                  </div>
                  <span className="font-serif text-[0.6rem] text-[var(--color-text-muted)] max-w-[56px] truncate text-center">
                    {npc.name || 'Unnamed'}
                    {count > 1 && <span className="text-[var(--color-gold)] font-bold ml-0.5">×{count}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: NPC Catalog */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-3">
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-2">NPC Catalog</div>
        {!showAvailable ? (
          <button
            onClick={() => setShowAvailable(true)}
            className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)]
                       rounded px-3 py-1.5 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors"
          >
            + Add NPCs
          </button>
        ) : (
          <div>
            {/* Search header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[var(--color-text-muted)] text-sm">⌕</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search NPCs…"
                autoFocus
                className="flex-1 bg-transparent border-none text-[var(--color-text)] text-sm outline-none placeholder:text-[var(--color-text-muted)] font-serif"
              />
              <button
                onClick={() => { setShowAvailable(false); setSearch(''); }}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs transition-colors"
              >
                Done
              </button>
            </div>

            {/* NPC grid */}
            {available.length === 0 ? (
              <p className="text-[#5a4a44] text-xs font-serif italic py-2">No NPCs match &ldquo;{search}&rdquo;</p>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {available.map(npc => {
                  const isAssigned = npcIds.includes(npc.id);
                  const imgUrl = npc.image_path ? resolveImageUrl(npc.image_path) : null;
                  const initial = npc.name?.trim()?.[0]?.toUpperCase() ?? '?';
                  return (
                    <button
                      key={npc.id}
                      onClick={() => onToggle(npc.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                        isAssigned
                          ? 'bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30'
                          : 'hover:bg-[#2e2825] border border-transparent'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-[#1a1714] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
                        {imgUrl
                          ? <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover" />
                          : <span className="text-[0.65rem] text-[var(--color-text-muted)] font-serif">{initial}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-xs text-[var(--color-text)] truncate">{npc.name || 'Unnamed'}</div>
                        {npc.cr && <div className="text-[0.55rem] text-[#5a4a44] uppercase">CR {npc.cr}</div>}
                      </div>
                      {isAssigned && (
                        <span className="text-[var(--color-gold)] text-xs flex-shrink-0">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
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
              onToggle={handleNpcToggle}
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
