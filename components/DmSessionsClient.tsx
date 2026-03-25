'use client';

import { useState, useRef, useCallback } from 'react';
import type { Session, Npc } from '@/lib/types';

function npcImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('uploads/') ? `/api/${path}` : `/${path}`;
}

// Fields to render in the detail panel — npcs replaced by NPC checkboxes
const FIELDS = [
  { key: 'goal',       label: 'Goal / Hook',    rows: 3,  placeholder: "What's the session goal? How does it open?",   cols: 1 },
  { key: 'scenes',     label: 'Scene Outline',  rows: 7,  placeholder: 'Encounters, beats, traps, treasure, exits…',   cols: 1 },
  { key: 'locations',  label: 'Locations',      rows: 5,  placeholder: 'Key locations and descriptions…',              cols: 2 },
  { key: 'loose_ends', label: 'Loose Ends',     rows: 4,  placeholder: 'Unresolved threads from last session…',        cols: 2 },
  { key: 'notes',      label: 'Notes',          rows: 4,  placeholder: 'Music, atmosphere, misc reminders…',           cols: 2 },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];
type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

function emptyValues(session: Session): Record<string, string | number> {
  return {
    title: session.title,
    date:  session.date,
    ...Object.fromEntries(FIELDS.map(f => [f.key, session[f.key as keyof Session] ?? ''])),
  };
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
    initial.length > 0 ? (initial[0].npc_ids ?? []) : []
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creating = useRef(false);

  const selected = sessions.find(s => s.id === selectedId) ?? null;

  function handleSelect(session: Session) {
    if (timer.current) clearTimeout(timer.current);
    setSelectedId(session.id);
    setValues(emptyValues(session));
    setNpcIds(session.npc_ids ?? []);
    setSaveStatus('idle');
  }

  const autosave = useCallback((id: string, patch: Record<string, unknown>) => {
    setSaveStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error('Save failed');
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('failed');
      }
    }, 600);
  }, []);

  function handleChange(key: string, value: string | number) {
    if (!selectedId) return;
    const updated = { ...values, [key]: value };
    setValues(updated);
    autosave(selectedId, { [key]: value });
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
    autosave(selectedId, { npc_ids: next });
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
    saving: 'text-[#8a7d6e]',
    saved: 'text-[#5a8a5a]',
    failed: 'text-[#c0392b]',
  }[saveStatus];

  return (
    <div>
      {/* Session box row */}
      <div className="border-b border-[#3d3530] bg-[#1e1b18] px-6 py-4">
        <div className="max-w-[860px] mx-auto flex gap-2.5 overflow-x-auto pb-1">
          {sessions.map(s => {
            const isSelected = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => handleSelect(s)}
                className={`flex-shrink-0 w-[96px] rounded px-2 py-2.5 flex flex-col items-center gap-1 text-left transition-colors border ${
                  isSelected
                    ? 'border-[#c9a84c] bg-[#231f1c]'
                    : 'border-[#3d3530] bg-[#1a1614] hover:border-[#5a4a44]'
                }`}
              >
                <span className="text-lg font-bold leading-none font-serif text-[#c9a84c]">
                  #{s.number}
                </span>
                <span className={`text-[13px] font-serif leading-tight line-clamp-2 text-center w-full ${isSelected ? 'text-[#c9a84c]' : 'text-[#8a7d6e]'}`}>
                  {s.title || 'Untitled'}
                </span>
                {s.date && (
                  <span className="text-[8px] text-[#3d3530]">{s.date}</span>
                )}
              </button>
            );
          })}

          {/* + box */}
          <button
            onClick={handleNew}
            className="flex-shrink-0 w-[88px] rounded border border-dashed border-[#3d3530] bg-transparent flex items-center justify-center text-[#3d3530] text-2xl hover:border-[#5a4a44] hover:text-[#5a4a44] transition-colors"
            title="New session"
          >
            +
          </button>
        </div>
      </div>

      {/* Session detail panel */}
      <div className="px-8 py-8 max-w-[860px] mx-auto">
        {!selected ? (
          <p className="text-[#5a4a44] font-serif italic text-sm">
            No sessions yet — click + to create your first one.
          </p>
        ) : (
          <div>
            {/* Header: #N title / date */}
            <div className="mb-8 pb-6 border-b border-[#3d3530]">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[#c9a84c] text-3xl font-serif">#{selected.number}</span>
                <input
                  type="text"
                  value={values.title as string}
                  placeholder="Session Title"
                  onChange={e => handleChange('title', e.target.value)}
                  className="bg-transparent border-none text-[#e8ddd0] text-3xl flex-1 outline-none placeholder:text-[#8a7d6e] font-serif"
                />
              </div>
              <input
                type="text"
                value={values.date as string}
                placeholder="Date"
                onChange={e => handleChange('date', e.target.value)}
                className="bg-transparent border-none border-b border-transparent focus:border-[#3d3530] text-[#8a7d6e] text-sm italic outline-none placeholder:text-[#3d3530]"
              />
            </div>

            {/* Full-width fields (cols: 1) */}
            {FIELDS.filter(f => f.cols === 1).map(f => (
              <div key={f.key} className="mb-7">
                <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] mb-1">{f.label}</div>
                <textarea
                  rows={f.rows}
                  value={values[f.key as FieldKey] as string}
                  placeholder={f.placeholder}
                  onChange={e => handleChange(f.key, e.target.value)}
                  className="w-full bg-[#231f1c] border border-[#3d3530] rounded text-[#e8ddd0] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[#c9a84c] placeholder:text-[#8a7d6e] font-serif"
                />
              </div>
            ))}

            {/* Key NPCs — checkbox list + two-column fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
              {/* Key NPCs checklist */}
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] mb-2">Key NPCs</div>
                {allNpcs.length === 0 ? (
                  <p className="text-[#5a4a44] text-xs font-serif italic">No NPCs yet.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {allNpcs.map(npc => {
                      const checked = npcIds.includes(npc.id);
                      const imgUrl = npcImageUrl(npc.image_path);
                      const initial = npc.name?.trim()?.[0]?.toUpperCase() ?? '?';
                      return (
                        <label
                          key={npc.id}
                          className={`flex items-center gap-2.5 cursor-pointer rounded px-2 py-1 transition-colors hover:bg-[#231f1c] ${checked ? '' : 'opacity-50'}`}
                        >
                          {/* Mini portrait */}
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-[#2e2825] border border-[#3d3530] flex items-center justify-center flex-shrink-0">
                            {imgUrl ? (
                              <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[0.7rem] text-[#8a7d6e] font-serif">{initial}</span>
                            )}
                          </div>
                          {/* Custom checkbox */}
                          <div
                            className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              checked ? 'border-[#c9a84c] bg-[#c9a84c]' : 'border-[#3d3530] bg-transparent'
                            }`}
                          >
                            {checked && <span className="text-black text-[8px] font-bold leading-none">✓</span>}
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleNpcToggle(npc.id)}
                            className="sr-only"
                          />
                          <span className="font-serif text-sm text-[#e8ddd0] truncate">{npc.name || 'Unnamed'}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Locations */}
              {FIELDS.filter(f => f.cols === 2).slice(0, 1).map(f => (
                <div key={f.key}>
                  <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] mb-1">{f.label}</div>
                  <textarea
                    rows={f.rows}
                    value={values[f.key as FieldKey] as string}
                    placeholder={f.placeholder}
                    onChange={e => handleChange(f.key, e.target.value)}
                    className="w-full bg-[#231f1c] border border-[#3d3530] rounded text-[#e8ddd0] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[#c9a84c] placeholder:text-[#8a7d6e] font-serif"
                  />
                </div>
              ))}
            </div>

            {/* Remaining two-column fields */}
            {(() => {
              const remaining = FIELDS.filter(f => f.cols === 2).slice(1);
              const pairs: (typeof FIELDS[number])[][] = [];
              for (let i = 0; i < remaining.length; i += 2) {
                pairs.push([remaining[i], remaining[i + 1]].filter(Boolean));
              }
              return pairs.map((pair, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
                  {pair.map(f => (
                    <div key={f.key}>
                      <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] mb-1">{f.label}</div>
                      <textarea
                        rows={f.rows}
                        value={values[f.key as FieldKey] as string}
                        placeholder={f.placeholder}
                        onChange={e => handleChange(f.key, e.target.value)}
                        className="w-full bg-[#231f1c] border border-[#3d3530] rounded text-[#e8ddd0] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[#c9a84c] placeholder:text-[#8a7d6e] font-serif"
                      />
                    </div>
                  ))}
                </div>
              ));
            })()}

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
