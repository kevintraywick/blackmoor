'use client'; // needs onChange, setTimeout — browser-only

import { useState, useRef, useCallback } from 'react';
import type { Session, Npc, MenagerieEntry } from '@/lib/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

function npcImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('uploads/') ? `/api/${path}` : `/${path}`;
}

export default function SessionForm({ session, allNpcs: initialNpcs }: { session: Session; allNpcs: Npc[] }) {
  const [values, setValues] = useState<Record<string, string | number>>({
    number: session.number,
    title:  session.title,
    goal:   session.goal ?? '',
    scenes: session.scenes ?? '',
    notes:  session.notes ?? '',
  });

  const [npcs, setNpcs] = useState<Npc[]>(initialNpcs);
  const [menagerie, setMenagerie] = useState<MenagerieEntry[]>(
    Array.isArray(session.menagerie) ? session.menagerie : []
  );
  const adding = useRef(false);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave — fires 600ms after the last keystroke
  const autosave = useCallback((patch: Record<string, unknown>) => {
    setSaveStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sessions/${session.id}`, {
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
  }, [session.id]);

  // Immediate save (no debounce) — for menagerie changes
  const saveNow = useCallback(async (patch: Record<string, unknown>) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
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
  }, [session.id]);

  function handleChange(key: string, value: string | number) {
    setValues(prev => ({ ...prev, [key]: value }));
    autosave({ [key]: value });
  }

  // Increment name: "Goblin" → "Goblin_2", "Goblin_2" → "Goblin_3"
  function incrementedName(name: string): string {
    const baseName = name.replace(/_\d+$/, '');
    if (!baseName) return '';
    const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = npcs.filter(n => n.name === baseName || n.name.match(new RegExp(`^${escaped}_\\d+$`)));
    let max = 1;
    for (const n of existing) {
      const m = n.name.match(/_(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
      else max = Math.max(max, 1);
    }
    return `${baseName}_${max + 1}`;
  }

  // Create a new NPC in the catalog (duplicate of source with incremented name), then add to menagerie
  async function addToMenagerie(source: Npc) {
    if (adding.current) return;
    adding.current = true;
    try {
      const id = Date.now().toString(36);
      const newName = incrementedName(source.name);

      // Create blank NPC
      const createRes = await fetch('/api/npcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!createRes.ok) return;

      // Copy all fields from source with incremented name
      const patch: Record<string, string> = {
        name: newName,
        species: source.species ?? '',
        cr: source.cr ?? '',
        hp: source.hp ?? '',
        hp_roll: source.hp_roll ?? '',
        ac: source.ac ?? '',
        speed: source.speed ?? '',
        attacks: source.attacks ?? '',
        traits: source.traits ?? '',
        actions: source.actions ?? '',
        notes: source.notes ?? '',
        image_path: source.image_path ?? '',
      };

      const patchRes = await fetch(`/api/npcs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!patchRes.ok) return;
      const newNpc: Npc = await patchRes.json();

      // Add new NPC to local list
      setNpcs(prev => [...prev, newNpc]);

      // Add to menagerie
      const hp = parseInt(newNpc.hp) || 0;
      const next = [...menagerie, { npc_id: newNpc.id, hp }];
      setMenagerie(next);
      saveNow({ menagerie: next });
    } finally {
      adding.current = false;
    }
  }

  // Remove a menagerie entry by index
  function removeFromMenagerie(index: number) {
    const next = menagerie.filter((_, i) => i !== index);
    setMenagerie(next);
    saveNow({ menagerie: next });
  }

  // Look up NPC data by id
  function getNpc(id: string): Npc | undefined {
    return npcs.find(n => n.id === id);
  }

  const statusText = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed — check connection' }[saveStatus];
  const statusColor = { idle: 'text-[#8a7d6e]', saving: 'text-[#8a7d6e]', saved: 'text-[#5a8a5a]', failed: 'text-[#c0392b]' }[saveStatus];

  const FIELDS = [
    { key: 'goal',   label: 'Goal / Hook',   rows: 3, placeholder: "What's the session goal? How does it open?" },
    { key: 'scenes', label: 'Scene',          rows: 4, placeholder: 'Encounters, beats, traps, treasure, exits…' },
  ] as const;

  return (
    <div className="max-w-[860px] mx-auto px-8 py-8">

      {/* Save status indicator */}
      <div className={`fixed bottom-4 right-4 text-xs px-3 py-1 rounded border border-[#3d3530] bg-[#231f1c] transition-opacity duration-200 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'} ${statusColor}`}>
        {statusText}
      </div>

      {/* Session header — number and title */}
      <div className="mb-8 pb-6 border-b border-[#3d3530]">
        <div className="flex items-baseline gap-2">
          <span className="text-[#c9a84c] text-3xl">#</span>
          <input
            type="number"
            value={values.number}
            min={1}
            onChange={e => handleChange('number', parseInt(e.target.value) || values.number)}
            className="bg-transparent border-none text-[#c9a84c] text-3xl w-14 outline-none [appearance:textfield]"
          />
          <input
            type="text"
            value={values.title}
            placeholder="Session Title"
            onChange={e => handleChange('title', e.target.value)}
            className="bg-transparent border-none text-[#e8ddd0] text-3xl flex-1 outline-none placeholder:text-[#8a7d6e]"
          />
        </div>
      </div>

      {/* Goal / Hook and Scene Outline */}
      {FIELDS.map(f => (
        <div key={f.key} className="mb-7">
          <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] mb-1">{f.label}</div>
          <textarea
            rows={f.rows}
            value={values[f.key] as string}
            placeholder={f.placeholder}
            onChange={e => handleChange(f.key, e.target.value)}
            className="w-full bg-[#231f1c] border border-[#3d3530] rounded text-[#e8ddd0] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[#c9a84c] placeholder:text-[#8a7d6e] font-serif"
          />
        </div>
      ))}

      {/* ─── Menagerie ─── */}
      <div className="mb-7">
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] mb-2">Menagerie</div>
        <div className="min-h-[60px] bg-[#231f1c] border border-[#3d3530] rounded px-3 py-3">
          {menagerie.length === 0 ? (
            <p className="text-[#5a4a44] italic text-sm font-serif m-0">
              No creatures yet — add from Available For Hire below
            </p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {menagerie.map((entry, idx) => {
                const npc = getNpc(entry.npc_id);
                if (!npc) return null;
                const imgUrl = npcImageUrl(npc.image_path);
                const initial = npc.name.trim() ? npc.name.trim()[0].toUpperCase() : '?';

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => removeFromMenagerie(idx)}
                    className="flex flex-col items-center gap-1 cursor-pointer bg-transparent border-none group"
                    title={`Click to remove ${npc.name}`}
                  >
                    <div className="relative w-10 h-10 rounded-full border-2 border-[#c9a84c] bg-[#2e2825] overflow-hidden
                                    group-hover:border-red-500 group-hover:opacity-75 transition-all">
                      {imgUrl ? (
                        <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover absolute inset-0" />
                      ) : (
                        <span className="text-sm text-[#8a7d6e] select-none font-serif absolute inset-0 flex items-center justify-center">
                          {initial}
                        </span>
                      )}
                      {/* HP badge */}
                      {entry.hp > 0 && (
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#8b1a1a] text-white text-[0.55rem] font-bold flex items-center justify-center border border-[#231f1c]">
                          {entry.hp}
                        </span>
                      )}
                    </div>
                    <span className="text-[0.6rem] uppercase tracking-[0.08em] text-[#8a7d6e] group-hover:text-red-400 transition-colors max-w-[56px] truncate">
                      {npc.name || 'Unnamed'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-7">
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] mb-1">Notes</div>
        <textarea
          rows={3}
          value={values.notes as string}
          placeholder="Music, atmosphere, misc reminders…"
          onChange={e => handleChange('notes', e.target.value)}
          className="w-full bg-[#231f1c] border border-[#3d3530] rounded text-[#e8ddd0] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[#c9a84c] placeholder:text-[#8a7d6e] font-serif"
        />
      </div>

      {/* ─── Available For Hire ─── */}
      <div className="mb-7">
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] mb-2">Available For Hire</div>
        <div className="min-h-[60px] bg-[#231f1c] border border-[#3d3530] rounded px-3 py-3">
          {initialNpcs.length === 0 ? (
            <p className="text-[#5a4a44] italic text-sm font-serif m-0">
              No NPCs in the catalog yet
            </p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {initialNpcs.map(npc => {
                const imgUrl = npcImageUrl(npc.image_path);
                const initial = npc.name.trim() ? npc.name.trim()[0].toUpperCase() : '?';

                return (
                  <div key={npc.id} className="flex items-center gap-1.5">
                    {/* NPC circle + name */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="relative w-10 h-10 rounded-full border-2 border-[#3d3530] bg-[#2e2825] overflow-hidden">
                        {imgUrl ? (
                          <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover absolute inset-0" />
                        ) : (
                          <span className="text-sm text-[#8a7d6e] select-none font-serif absolute inset-0 flex items-center justify-center">
                            {initial}
                          </span>
                        )}
                        {/* HP badge */}
                        {parseInt(npc.hp) > 0 && (
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#8b1a1a] text-white text-[0.55rem] font-bold flex items-center justify-center border border-[#231f1c]">
                            {npc.hp}
                          </span>
                        )}
                      </div>
                      <span className="text-[0.6rem] uppercase tracking-[0.08em] text-[#8a7d6e] max-w-[56px] truncate">
                        {npc.name || 'Unnamed'}
                      </span>
                    </div>
                    {/* Up arrow — add to menagerie */}
                    <button
                      type="button"
                      onClick={() => addToMenagerie(npc)}
                      className="w-6 h-6 rounded bg-[#3d3530] hover:bg-[#c9a84c] text-[#8a7d6e] hover:text-[#1a1614]
                                 flex items-center justify-center transition-colors cursor-pointer border-none text-sm font-bold"
                      title={`Add ${npc.name} to menagerie`}
                    >
                      ↑
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
