'use client';

import { useState, useRef, useCallback } from 'react';
import type { Npc } from '@/lib/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

const EMPTY_NPC: Omit<Npc, 'id'> = {
  name: '', species: '', cr: '', hp: '', ac: '', speed: '',
  attacks: '', traits: '', actions: '', notes: '',
};

function NpcCircle({
  npc,
  isActive,
  onClick,
}: {
  npc: Npc;
  isActive: boolean;
  onClick: () => void;
}) {
  const initial = npc.name.trim() ? npc.name.trim()[0].toUpperCase() : '?';
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-none"
    >
      <div className={`w-20 h-20 rounded-full border-[3px] transition-all flex items-center justify-center
        bg-[#2e2825] ${isActive ? 'border-[#c9a84c]' : 'border-[#3d3530] hover:border-[#8a7d6e] hover:scale-105'}`}>
        <span className="text-[1.6rem] text-[#8a7d6e] select-none font-serif">{initial}</span>
      </div>
      <span className={`text-[0.72rem] uppercase tracking-[0.1em] transition-colors ${
        isActive ? 'text-[#c9a84c]' : 'text-[#8a7d6e]'
      }`}>
        {npc.name || 'Unnamed'}
      </span>
    </button>
  );
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
    initial[0] ? { ...EMPTY_NPC, ...initial[0] } : { ...EMPTY_NPC }
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creating = useRef(false);

  const active = npcs.find(n => n.id === activeId) ?? null;

  function handleSelect(npc: Npc) {
    if (timer.current) clearTimeout(timer.current);
    setActiveId(npc.id);
    setValues({ ...EMPTY_NPC, ...npc });
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

  async function handleNew() {
    if (creating.current) return;
    creating.current = true;
    try {
      const id = Date.now().toString(36);
      const res = await fetch('/api/npcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) return;
      const npc: Npc = await res.json();
      setNpcs(prev => [...prev, npc]);
      handleSelect(npc);
    } finally {
      creating.current = false;
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
      setValues({ ...EMPTY_NPC });
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
        {npcs.map(npc => (
          <NpcCircle
            key={npc.id}
            npc={npc}
            isActive={activeId === npc.id}
            onClick={() => handleSelect(npc)}
          />
        ))}

        {/* + circle */}
        <button
          onClick={handleNew}
          className="flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-none"
        >
          <div className="w-20 h-20 rounded-full border-[3px] border-dashed border-[#3d3530] hover:border-[#8a7d6e]
                          transition-all flex items-center justify-center bg-transparent">
            <span className="text-[1.8rem] text-[#3d3530] hover:text-[#8a7d6e] leading-none select-none">+</span>
          </div>
          <span className="text-[0.72rem] uppercase tracking-[0.1em] text-[#3d3530]">New NPC</span>
        </button>
      </div>

      {!active ? (
        <p className="text-[#5a4a44] font-serif italic text-sm text-center mt-8">
          No NPCs yet — click + to create your first one.
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
            {/* Monster circle */}
            <div className="w-14 h-14 rounded-full border-2 border-[#8b1a1a] bg-[#2e2825] flex items-center justify-center flex-shrink-0">
              <span className="text-[1.2rem] text-[#8a7d6e] select-none font-serif">
                {values.name?.trim() ? values.name.trim()[0].toUpperCase() : '?'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 flex-1 min-w-0">
              <input
                value={values.name}
                placeholder="NPC Name…"
                onChange={e => handleChange('name', e.target.value)}
                className={fi}
              />
              <span className="text-[#3d3530]">·</span>
              <input
                value={values.species}
                placeholder="Type / Species…"
                onChange={e => handleChange('species', e.target.value)}
                className="bg-transparent border-none border-b border-[#3d3530] text-[#e8ddd0] font-serif text-lg font-bold
                           outline-none focus:border-b-[#c9a84c] placeholder:text-[#8a7452] pb-0.5"
                style={{ minWidth: 80, width: 140 }}
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
            {(['cr', 'hp', 'ac', 'speed'] as const).map(key => (
              <StatField
                key={key}
                label={key.toUpperCase()}
                value={values[key]}
                onChange={v => handleChange(key, v)}
              />
            ))}
          </div>

          {/* 2-col content grid */}
          <div className="grid grid-cols-2 border border-[#3d3530] border-t-0 rounded-bl-md rounded-br-md overflow-hidden">
            <div className="bg-[#231f1c] border-r border-b border-[#3d3530] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Attacks</div>
              <textarea
                rows={5}
                value={values.attacks}
                onChange={e => handleChange('attacks', e.target.value)}
                className={ta}
                placeholder="Attack names, bonuses, damage…"
              />
            </div>

            <div className="bg-[#231f1c] border-b border-[#3d3530] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Traits & Abilities</div>
              <textarea
                rows={5}
                value={values.traits}
                onChange={e => handleChange('traits', e.target.value)}
                className={ta}
                placeholder="Passive traits, resistances, immunities…"
              />
            </div>

            <div className="bg-[#231f1c] border-r border-[#3d3530] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Actions</div>
              <textarea
                rows={5}
                value={values.actions}
                onChange={e => handleChange('actions', e.target.value)}
                className={ta}
                placeholder="Bonus actions, reactions, legendary actions…"
              />
            </div>

            <div className="bg-[#231f1c] border-[#3d3530] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Notes</div>
              <textarea
                rows={5}
                value={values.notes}
                onChange={e => handleChange('notes', e.target.value)}
                className={ta}
                placeholder="Tactics, lore, encounter notes…"
              />
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
              <button
                onClick={handleDeleteConfirmed}
                className="px-6 py-2 rounded bg-red-700 text-white text-sm font-bold hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-6 py-2 rounded border border-[#3d3530] text-[#8a7d6e] text-sm
                           hover:text-[#e8ddd0] hover:border-[#5a4f46] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
