'use client';

import { useState, useRef, useCallback } from 'react';
import type { Npc } from '@/lib/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

const EMPTY_NPC: Omit<Npc, 'id'> = {
  name: '', species: '', cr: '', hp: '', ac: '', speed: '',
  attacks: '', traits: '', actions: '', notes: '', image_path: null,
};

function npcImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('uploads/') ? `/api/${path}` : `/${path}`;
}

function StatField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[#c9a84c]">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="w-14 bg-transparent border-b border-[#3d3530] text-[#e8ddd0] font-serif text-lg font-bold
                   outline-none focus:border-[#c9a84c] placeholder:text-[#8a7452] pb-0.5 text-center"
      />
    </div>
  );
}

export default function NpcPageClient({ initial }: { initial: Npc[] }) {
  const [npcs, setNpcs] = useState<Npc[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [values, setValues] = useState<Record<string, string>>(
    initial[0]
      ? Object.fromEntries(Object.entries({ ...EMPTY_NPC, ...initial[0] }).map(([k, v]) => [k, v ?? '']))
      : Object.fromEntries(Object.entries(EMPTY_NPC).map(([k, v]) => [k, v ?? '']))
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addDragOver, setAddDragOver] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creating = useRef(false);
  const addFileRef = useRef<HTMLInputElement>(null);
  const portraitFileRef = useRef<HTMLInputElement>(null);

  const active = npcs.find(n => n.id === activeId) ?? null;

  function handleSelect(npc: Npc) {
    if (timer.current) clearTimeout(timer.current);
    setActiveId(npc.id);
    setValues(Object.fromEntries(Object.entries({ ...EMPTY_NPC, ...npc }).map(([k, v]) => [k, v ?? ''])));
    setSaveStatus('idle');
  }

  const autosave = useCallback((id: string, patch: Record<string, string>) => {
    setSaveStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/npcs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('failed');
      }
    }, 600);
  }, []);

  function handleChange(key: string, value: string) {
    if (!activeId) return;
    const updated = { ...values, [key]: value };
    setValues(updated);
    autosave(activeId, { [key]: value });
    if (key === 'name') {
      setNpcs(prev => prev.map(n => n.id === activeId ? { ...n, name: value } : n));
    }
  }

  async function handleNew(imageFile?: File) {
    if (creating.current) return;
    creating.current = true;
    try {
      const id = Date.now().toString(36);
      let npc: Npc;

      if (imageFile) {
        const fd = new FormData();
        fd.append('id', id);
        fd.append('image', imageFile);
        const res = await fetch('/api/npcs', { method: 'POST', body: fd });
        if (!res.ok) return;
        npc = await res.json();
      } else {
        const res = await fetch('/api/npcs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) return;
        npc = await res.json();
      }

      setNpcs(prev => [...prev, npc]);
      handleSelect(npc);
    } finally {
      creating.current = false;
    }
  }

  async function handleImageUpload(file: File) {
    if (!activeId) return;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`/api/npcs/${activeId}`, { method: 'PATCH', body: fd });
    if (res.ok) {
      const updated: Npc = await res.json();
      setNpcs(prev => prev.map(n => n.id === activeId ? updated : n));
    }
  }

  async function handleDeleteConfirmed() {
    if (!activeId) return;
    await fetch(`/api/npcs/${activeId}`, { method: 'DELETE' });
    const remaining = npcs.filter(n => n.id !== activeId);
    setNpcs(remaining);
    setConfirmDelete(false);
    if (remaining.length > 0) {
      handleSelect(remaining[remaining.length - 1]);
    } else {
      setActiveId(null);
      setValues(Object.fromEntries(Object.entries(EMPTY_NPC).map(([k, v]) => [k, v ?? ''])));
    }
  }

  const sh = 'text-[0.7rem] uppercase tracking-[0.18em] text-[#c9a84c] mb-2 pb-1.5 border-b border-[#3d3530] font-sans';
  const ta = 'w-full bg-transparent border-none text-[#c8bfb5] font-serif text-[0.88rem] leading-[1.55] resize-none outline-none min-h-[90px] placeholder:text-[#8a7452]';
  const fi = 'bg-transparent border-none border-b border-[#3d3530] text-[#e8ddd0] font-serif text-3xl font-bold outline-none focus:border-b-[#c9a84c] placeholder:text-[#8a7452] pb-0.5 flex-1';

  const statusText  = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed' }[saveStatus];
  const statusColor = saveStatus === 'saved' ? 'text-[#5a8a5a]' : saveStatus === 'failed' ? 'text-[#c0392b]' : 'text-[#8a7d6e]';

  return (
    <div className="max-w-[780px] mx-auto px-4 pb-16">

      {/* NPC selector row */}
      <div className="flex justify-center gap-4 flex-wrap py-5 bg-[#231f1c] border-b border-[#3d3530] -mx-4 px-4 mb-6">
        {npcs.map(npc => {
          const isActive = activeId === npc.id;
          const imgUrl = npcImageUrl(npc.image_path);
          const initial = npc.name.trim() ? npc.name.trim()[0].toUpperCase() : '?';

          return (
            <button
              key={npc.id}
              onClick={() => handleSelect(npc)}
              className="flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-none"
            >
              <div
                className={`relative w-20 h-20 rounded-full border-[3px] transition-all overflow-hidden
                  bg-[#2e2825] ${isActive ? 'border-[#c9a84c]' : 'border-[#3d3530] hover:border-[#8a7d6e] hover:scale-105'}`}
                onDragOver={isActive ? (e => e.preventDefault()) : undefined}
                onDrop={isActive ? (e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file) handleImageUpload(file);
                }) : undefined}
              >
                {imgUrl ? (
                  <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover absolute inset-0" />
                ) : (
                  <span className="text-[1.6rem] text-[#8a7d6e] select-none font-serif absolute inset-0 flex items-center justify-center">
                    {initial}
                  </span>
                )}
              </div>
              <span className={`text-[0.72rem] uppercase tracking-[0.1em] transition-colors ${
                isActive ? 'text-[#c9a84c]' : 'text-[#8a7d6e]'
              }`}>
                {npc.name || 'Unnamed'}
              </span>
            </button>
          );
        })}

        {/* + circle — drop image here to create NPC with that portrait */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            onClick={() => addFileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setAddDragOver(true); }}
            onDragLeave={() => setAddDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setAddDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleNew(file);
              else handleNew();
            }}
            className={`w-20 h-20 rounded-full border-[3px] border-dashed transition-all flex items-center justify-center cursor-pointer
              ${addDragOver
                ? 'border-[#c9a84c] bg-[#2e2825] scale-105'
                : 'border-[#3d3530] hover:border-[#8a7d6e] bg-transparent'
              }`}
          >
            <span className={`text-[1.8rem] leading-none select-none transition-colors ${addDragOver ? 'text-[#c9a84c]' : 'text-[#3d3530]'}`}>
              +
            </span>
          </div>
          <span className="text-[0.72rem] uppercase tracking-[0.1em] text-[#3d3530]">New NPC</span>
          <input
            ref={addFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              handleNew(file ?? undefined);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {!active ? (
        <p className="text-[#5a4a44] font-serif italic text-sm text-center mt-8">
          No NPCs yet — click + to create one, or drop an image on + to create with a portrait.
        </p>
      ) : (
        <>
          {saveStatus !== 'idle' && (
            <div className={`fixed bottom-4 right-4 text-xs px-3 py-1 rounded border border-[#3d3530] bg-[#231f1c] ${statusColor}`}>
              {statusText}
            </div>
          )}

          {/* Header */}
          <div className="bg-[#231f1c] border border-[#3d3530] rounded-tl-md rounded-tr-md px-4 py-3 border-b-0 flex items-center gap-4">
            {/* Portrait circle — drop zone */}
            <div
              onClick={() => portraitFileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleImageUpload(file);
              }}
              className="relative w-14 h-14 rounded-full border-2 border-[#8b1a1a] bg-[#2e2825] flex items-center justify-center
                         flex-shrink-0 cursor-pointer overflow-hidden group"
              title="Drop or click to change portrait"
            >
              {npcImageUrl(active.image_path) ? (
                <img src={npcImageUrl(active.image_path)!} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span className="text-[1.2rem] text-[#8a7d6e] select-none font-serif">
                  {values.name?.trim() ? values.name.trim()[0].toUpperCase() : '?'}
                </span>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-full flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 text-white text-[9px] uppercase tracking-wide transition-opacity">
                  change
                </span>
              </div>
            </div>
            <input
              ref={portraitFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = '';
              }}
            />

            <div className="flex items-baseline gap-2 flex-1 min-w-0">
              <input
                value={values.name}
                placeholder="NPC Name…"
                onChange={e => handleChange('name', e.target.value)}
                className={fi}
              />
            </div>

            {/* Delete button */}
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete NPC"
              className="w-8 h-8 rounded-full bg-red-900/60 text-red-400 text-sm flex items-center justify-center
                         hover:bg-red-700 hover:text-white transition-colors flex-shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Stats row */}
          <div className="flex gap-6 flex-wrap bg-[#1e1b18] border border-[#3d3530] border-t-0 border-b-0 px-6 py-3">
            {(['cr', 'ac', 'speed'] as const).map(key => (
              <StatField
                key={key}
                label={key.toUpperCase()}
                value={values[key]}
                onChange={v => handleChange(key, v)}
              />
            ))}
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[#c9a84c]">HP</span>
              <input
                value={values.hp}
                onChange={e => handleChange('hp', e.target.value)}
                placeholder="e.g. 15 (2d8+6)"
                className="bg-transparent border-b border-[#3d3530] text-[#e8ddd0] font-serif text-lg font-bold
                           outline-none focus:border-[#c9a84c] placeholder:text-[#8a7452] pb-0.5"
                style={{ width: 160 }}
              />
            </div>
          </div>

          {/* 2-col content grid */}
          <div className="grid grid-cols-2 border border-[#3d3530] border-t-0 rounded-bl-md rounded-br-md overflow-hidden">
            <div className="bg-[#231f1c] border-r border-b border-[#3d3530] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Attacks</div>
              <textarea rows={5} value={values.attacks} onChange={e => handleChange('attacks', e.target.value)} className={ta} placeholder="Attack names, bonuses, damage…" />
            </div>
            <div className="bg-[#231f1c] border-b border-[#3d3530] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Traits & Abilities</div>
              <textarea rows={5} value={values.traits} onChange={e => handleChange('traits', e.target.value)} className={ta} placeholder="Passive traits, resistances, immunities…" />
            </div>
            <div className="bg-[#231f1c] border-r border-[#3d3530] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Actions</div>
              <textarea rows={5} value={values.actions} onChange={e => handleChange('actions', e.target.value)} className={ta} placeholder="Bonus actions, reactions, legendary actions…" />
            </div>
            <div className="bg-[#231f1c] border-[#3d3530] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Notes</div>
              <textarea rows={5} value={values.notes} onChange={e => handleChange('notes', e.target.value)} className={ta} placeholder="Tactics, lore, encounter notes…" />
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1614] border border-[#3d3530] rounded px-8 py-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="font-serif text-[1.1rem] italic text-[#e8ddd0] mb-6 text-center">
              Delete {active?.name || 'this NPC'}?
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleDeleteConfirmed} className="px-6 py-2 rounded bg-red-700 text-white text-sm font-bold hover:bg-red-600 transition-colors">
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-6 py-2 rounded border border-[#3d3530] text-[#8a7d6e] text-sm hover:text-[#e8ddd0] hover:border-[#5a4f46] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
