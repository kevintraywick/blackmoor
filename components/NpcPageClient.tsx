'use client';

import { useState, useRef } from 'react';
import type { Npc } from '@/lib/types';
import { rollDice } from '@/lib/dice';
import { lookupSrd } from '@/lib/srd-hp';
import { useAutosave } from '@/lib/useAutosave';
import { resolveImageUrl } from '@/lib/imageUrl';
import { lookupNpcImage } from '@/lib/npc-images';

const EMPTY_NPC: Omit<Npc, 'id'> = {
  name: '', species: '', cr: '', hp: '', hp_roll: '', ac: '', speed: '',
  attacks: '', traits: '', actions: '', notes: '', image_path: '',
};

function StatField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-gold)]">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="w-14 bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] font-serif text-lg font-bold
                   outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5 text-center"
      />
    </div>
  );
}

export default function NpcPageClient({ initial }: { initial: Npc[] }) {
  const [npcs, setNpcs] = useState<Npc[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(EMPTY_NPC).map(([k, v]) => [k, v ?? '']))
  );
  const { save: autosave, status: saveStatus } = useAutosave(() => `/api/npcs/${activeId}`);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addDragOver, setAddDragOver] = useState(false);
  const creating = useRef(false);
  const portraitFileRef = useRef<HTMLInputElement>(null);

  const active = npcs.find(n => n.id === activeId) ?? null;

  function handleOutsideClick() {
    setActiveId(null);
  }

  function handleSelect(npc: Npc) {
    setActiveId(npc.id);
    setValues(Object.fromEntries(Object.entries({ ...EMPTY_NPC, ...npc }).map(([k, v]) => [k, v ?? ''])));
  }

  function handleChange(key: string, value: string) {
    if (!activeId) return;
    const updated = { ...values, [key]: value };
    setValues(updated);
    autosave({ [key]: value });
    // Keep npcs array in sync so clicking away and back doesn't lose changes
    setNpcs(prev => prev.map(n => n.id === activeId ? { ...n, [key]: value } : n));
  }

  function handleRollHp(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    let formula = values.hp_roll;
    // Fallback: if hp_roll is empty, try SRD lookup by name
    if (!formula.trim()) {
      const match = lookupSrd(values.name);
      if (!match) return;
      formula = match.hp;
      handleChange('hp_roll', formula);
    }
    const result = rollDice(formula);
    if (result !== null) {
      handleChange('hp', String(result));
    }
  }

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

  async function handleDuplicate(source: Npc) {
    if (creating.current) return;
    creating.current = true;
    try {
      const id = Date.now().toString(36);
      const newName = incrementedName(source.name);

      // Create the NPC on the server
      const res = await fetch('/api/npcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) return;
      let npc: Npc = await res.json();

      // Copy all fields from source, with incremented name and blank HP.
      // If source has no image, try to auto-link from the base creature name.
      const imagePath = source.image_path || lookupNpcImage(source.name) || '';
      const patch: Record<string, string> = {
        name: newName,
        species: source.species ?? '',
        cr: source.cr ?? '',
        hp: '',
        hp_roll: source.hp_roll ?? '',
        ac: source.ac ?? '',
        speed: source.speed ?? '',
        attacks: source.attacks ?? '',
        traits: source.traits ?? '',
        actions: source.actions ?? '',
        notes: source.notes ?? '',
        image_path: imagePath,
      };

      const patchRes = await fetch(`/api/npcs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (patchRes.ok) {
        npc = await patchRes.json();
      } else {
        npc = { ...npc, ...patch };
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

  // When an NPC name is first set (on creation), auto-fill stats from SRD
  function handleNameChange(value: string) {
    handleChange('name', value);

    const trimmed = value.trim();
    if (!trimmed) return;

    const patch: Record<string, string> = {};

    // Auto-fill stats from SRD (only when hp_roll is empty)
    if (!values.hp_roll) {
      const match = lookupSrd(value);
      if (match) {
        patch.hp_roll = match.hp;
        if (!values.ac) patch.ac = match.ac;
        if (!values.speed) patch.speed = match.speed;
        if (!values.cr) patch.cr = match.cr;
      }
    }

    // Auto-link image if no image is currently set
    if (!values.image_path) {
      const img = lookupNpcImage(value);
      if (img) patch.image_path = img;
    }

    if (Object.keys(patch).length > 0) {
      const updated = { ...values, name: value, ...patch };
      setValues(updated);
      autosave(patch);
    }
  }

  const sh = 'text-[0.7rem] uppercase tracking-[0.18em] text-[var(--color-gold)] mb-2 pb-1.5 border-b border-[var(--color-border)] font-sans';
  const ta = 'w-full bg-transparent border-none text-[var(--color-text-body)] font-serif text-[0.88rem] leading-[1.55] resize-none outline-none min-h-[90px] placeholder:text-[#8a7452]';
  const fi = 'bg-transparent border-none border-b border-[var(--color-border)] text-[var(--color-text)] font-serif text-3xl font-bold outline-none focus:border-b-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5 flex-1';

  const statusText  = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed' }[saveStatus];
  const statusColor = saveStatus === 'saved' ? 'text-[#5a8a5a]' : saveStatus === 'failed' ? 'text-[#c0392b]' : 'text-[var(--color-text-muted)]';

  return (
    <div className="max-w-[1000px] mx-auto px-4 pb-16" onClick={handleOutsideClick}>

      {/* NPC selector row */}
      <div
        className="flex justify-center gap-4 flex-wrap py-5 bg-[var(--color-surface)] border-b border-[var(--color-border)] -mx-4 px-4 mb-6"
        onClick={e => e.stopPropagation()}
      >
        {npcs.map(npc => {
          const isActive = activeId === npc.id;
          const imgUrl = npc.image_path ? resolveImageUrl(npc.image_path) : null;
          const initial = npc.name.trim() ? npc.name.trim()[0].toUpperCase() : '?';

          return (
            <button
              key={npc.id}
              onClick={e => { e.stopPropagation(); e.altKey ? handleDuplicate(npc) : handleSelect(npc); }}
              className="flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-none"
            >
              <div
                className={`relative w-20 h-20 rounded-full border-[3px] transition-all overflow-hidden
                  bg-[#2e2825] ${isActive ? 'border-[var(--color-gold)]' : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)] hover:scale-105'}`}
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
                  <span className="text-[1.6rem] text-[var(--color-text-muted)] select-none font-serif absolute inset-0 flex items-center justify-center">
                    {initial}
                  </span>
                )}
              </div>
              <span className={`text-[0.72rem] uppercase tracking-[0.1em] transition-colors ${
                isActive ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
              }`}>
                {npc.name || 'Unnamed'}
              </span>
            </button>
          );
        })}

        {/* + circle — click to create blank NPC, drop image to create with portrait */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            onClick={() => handleNew()}
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
                ? 'border-[var(--color-gold)] bg-[#2e2825] scale-105'
                : 'border-[var(--color-gold)]/40 hover:border-[var(--color-gold)] bg-transparent'
              }`}
          >
            <span className={`text-[1.8rem] leading-none select-none transition-colors ${addDragOver ? 'text-[var(--color-gold)]' : 'text-[var(--color-gold)]/60'}`}>
              +
            </span>
          </div>
          <span className="text-[0.72rem] uppercase tracking-[0.1em] text-[var(--color-gold)]/60">New NPC</span>
        </div>
      </div>

      {!active ? (
        <p className="text-[#5a4a44] font-serif italic text-sm text-center mt-8">
          No NPCs yet — click + to create one, or drop an image on + to create with a portrait.
        </p>
      ) : (
        <>
          {saveStatus !== 'idle' && (
            <div className={`fixed bottom-4 right-4 text-xs px-3 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] ${statusColor}`}>
              {statusText}
            </div>
          )}

          <div className="-mx-4" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-tl-md rounded-tr-md px-4 py-3 border-b-0 flex items-center gap-4">
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
              {active.image_path ? (
                <img src={resolveImageUrl(active.image_path)} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span className="text-[1.2rem] text-[var(--color-text-muted)] select-none font-serif">
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

            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <input
                  value={values.image_path ?? ''}
                  onChange={e => handleChange('image_path', e.target.value)}
                  placeholder="images/NPCs/orc.png"
                  title="Path to a committed public image, e.g. images/NPCs/orc.png"
                  className="bg-transparent border-b border-[var(--color-surface-raised)] text-[var(--color-text-dim)] font-sans text-[0.65rem]
                             outline-none focus:border-[var(--color-gold)] focus:text-[var(--color-text-muted)] placeholder:text-[var(--color-surface-raised)] pb-0.5 w-full"
                />
              </div>
              <input
                value={values.name}
                placeholder="NPC Name…"
                onChange={e => handleNameChange(e.target.value)}
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
          <div className="flex gap-6 flex-wrap items-end bg-[#1e1b18] border border-[var(--color-border)] border-t-0 border-b-0 px-6 py-3">
            {(['cr', 'ac', 'speed'] as const).map(key => (
              <StatField
                key={key}
                label={key.toUpperCase()}
                value={values[key]}
                onChange={v => handleChange(key, v)}
              />
            ))}

            {/* HP Roll → 🎲 → HP */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-gold)]">HP Roll</span>
              <input
                value={values.hp_roll}
                onChange={e => handleChange('hp_roll', e.target.value)}
                placeholder="3d6+3"
                className="w-20 bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] font-serif text-lg font-bold
                           outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5 text-center"
              />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-gold)]">&nbsp;</span>
              <button
                onClick={handleRollHp}
                type="button"
                title="Roll HP from formula"
                className="text-xl leading-[1.55] hover:scale-125 transition-transform active:scale-95 select-none cursor-pointer
                           bg-transparent border-none pb-0.5"
              >
                🎲
              </button>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-gold)]">HP</span>
              <input
                type="number"
                value={values.hp}
                onChange={e => handleChange('hp', e.target.value)}
                placeholder="—"
                className="w-14 bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] font-serif text-lg font-bold
                           outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5 text-center
                           [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* 2-col content grid */}
          <div className="grid grid-cols-2 border border-[var(--color-border)] border-t-0 rounded-bl-md rounded-br-md overflow-hidden">
            <div className="bg-[var(--color-surface)] border-r border-b border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Attacks</div>
              <textarea rows={5} value={values.attacks} onChange={e => handleChange('attacks', e.target.value)} className={ta} placeholder="Attack names, bonuses, damage…" />
            </div>
            <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Traits & Abilities</div>
              <textarea rows={5} value={values.traits} onChange={e => handleChange('traits', e.target.value)} className={ta} placeholder="Passive traits, resistances, immunities…" />
            </div>
            <div className="bg-[var(--color-surface)] border-r border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Actions</div>
              <textarea rows={5} value={values.actions} onChange={e => handleChange('actions', e.target.value)} className={ta} placeholder="Bonus actions, reactions, legendary actions…" />
            </div>
            <div className="bg-[var(--color-surface)] border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Notes</div>
              <textarea rows={5} value={values.notes} onChange={e => handleChange('notes', e.target.value)} className={ta} placeholder="Tactics, lore, encounter notes…" />
            </div>
          </div>
          </div>{/* end -mx-4 wrapper */}
        </>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={e => e.stopPropagation()}>
          <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-8 py-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="font-serif text-[1.1rem] italic text-[var(--color-text)] mb-6 text-center">
              Delete {active?.name || 'this NPC'}?
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleDeleteConfirmed} className="px-6 py-2 rounded bg-red-700 text-white text-sm font-bold hover:bg-red-600 transition-colors">
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-6 py-2 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm hover:text-[var(--color-text)] hover:border-[var(--color-text-dim)] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
