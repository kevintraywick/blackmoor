'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { Npc } from '@/lib/types';
import { diceRange, rollDice } from '@/lib/dice';
import { lookupSrd, SRD_CREATURES } from '@/lib/srd-hp';
import { useAutosave } from '@/lib/useAutosave';
import { resolveImageUrl } from '@/lib/imageUrl';
import { lookupNpcImage } from '@/lib/npc-images';

const EMPTY_NPC: Omit<Npc, 'id'> = {
  name: '', species: '', cr: '', hp: '', hp_roll: '', ac: '', speed: '',
  attacks: '', traits: '', actions: '', notes: '', gold: '', equipment: '', treasure: '', image_path: '',
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

function HpRangeDisplay({ hpRoll }: { hpRoll: string }) {
  const range = hpRoll ? diceRange(hpRoll) : null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-gold)]">HP Range</span>
      <span className="text-[var(--color-text)] font-serif text-lg font-bold pb-0.5 text-center w-20">
        {range ? `${range.min}–${range.max}` : '—'}
      </span>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [addedFlash, setAddedFlash] = useState<string | null>(null);
  const creating = useRef(false);
  const portraitFileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const active = npcs.find(n => n.id === activeId) ?? null;
  const recentNpcs = recentIds.map(id => npcs.find(n => n.id === id)).filter(Boolean) as Npc[];

  // Load recently used from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('blackmoor-recent-npcs');
      if (stored) setRecentIds(JSON.parse(stored));
    } catch { /* silent */ }
  }, []);

  function addToRecents(npcId: string) {
    setRecentIds(prev => {
      const next = [npcId, ...prev.filter(id => id !== npcId)].slice(0, 12);
      try { localStorage.setItem('blackmoor-recent-npcs', JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
  }

  // Alt+click: add NPC instance to current session
  const addToSession = useCallback(async (npc: Npc) => {
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('blackmoor-last-session') : null;
    if (!sessionId) return;

    // Fetch current session to get npc_ids + menagerie
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) return;
    const session = await res.json();
    const curIds: string[] = Array.isArray(session.npc_ids) ? session.npc_ids : [];
    const curMenagerie: { npc_id: string; hp: number; maxHp?: number; label?: string }[] = Array.isArray(session.menagerie) ? session.menagerie : [];

    // Find highest label number for this template
    let maxLabel = 0;
    for (const e of curMenagerie) {
      if (e.npc_id === npc.id && e.label) {
        const m = e.label.match(/(\d+)$/);
        if (m) maxLabel = Math.max(maxLabel, parseInt(m[1], 10));
      }
    }
    const label = `${npc.name} ${maxLabel + 1}`;
    const rolled = npc.hp_roll ? rollDice(npc.hp_roll) : (parseInt(npc.hp, 10) || 1);
    const hp = rolled ?? 1;

    const nextIds = [...curIds, npc.id];
    const nextMenagerie = [...curMenagerie, { npc_id: npc.id, hp, maxHp: hp, label }];

    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npc_ids: nextIds, menagerie: nextMenagerie }),
    });

    // Flash confirmation
    setAddedFlash(npc.id);
    setTimeout(() => setAddedFlash(null), 1200);
  }, []);

  // Auto-suggest: merge library NPCs + SRD creatures
  type Suggestion = { type: 'library'; npc: Npc } | { type: 'srd'; name: string; cr: string; hpRoll: string };

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as Suggestion[];

    const results: Suggestion[] = [];
    const matchedNames = new Set<string>();

    // Library NPCs first
    for (const npc of npcs) {
      if (npc.name.toLowerCase().includes(q)) {
        results.push({ type: 'library', npc });
        matchedNames.add(npc.name.toLowerCase());
      }
    }

    // SRD creatures not already in library
    for (const [key, stats] of Object.entries(SRD_CREATURES)) {
      if (key.includes(q) && !matchedNames.has(key)) {
        const displayName = key.split(/[\s_]+/).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
        results.push({ type: 'srd', name: displayName, cr: stats.cr, hpRoll: stats.hp });
      }
    }

    return results;
  }, [npcs, searchQuery]);

  // Show "+ New" option when no exact match in either source
  const showNewOption = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return false;
    if (npcs.some(n => n.name.toLowerCase() === q)) return false;
    if (SRD_CREATURES[q]) return false;
    return true;
  }, [npcs, searchQuery]);

  function handleSelect(npc: Npc) {
    setActiveId(npc.id);
    setValues(Object.fromEntries(Object.entries({ ...EMPTY_NPC, ...npc }).map(([k, v]) => [k, v ?? ''])));
    setSearchQuery('');
    setHighlightIdx(-1);
    addToRecents(npc.id);
  }

  function handleChange(key: string, value: string) {
    if (!activeId) return;
    const updated = { ...values, [key]: value };
    setValues(updated);
    autosave({ [key]: value });
    setNpcs(prev => prev.map(n => n.id === activeId ? { ...n, [key]: value } : n));
  }

  async function handleNew(prefillName?: string) {
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
      let npc: Npc = await res.json();

      if (prefillName) {
        const patch: Record<string, string> = { name: prefillName };
        // Auto-fill from SRD
        const match = lookupSrd(prefillName);
        if (match) {
          patch.hp_roll = match.hp;
          patch.ac = match.ac;
          patch.speed = match.speed;
          patch.cr = match.cr;
        }
        // Auto-link image
        const img = lookupNpcImage(prefillName);
        if (img) patch.image_path = img;

        const patchRes = await fetch(`/api/npcs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (patchRes.ok) npc = await patchRes.json();
        else npc = { ...npc, ...patch };
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

  function handleNameChange(value: string) {
    handleChange('name', value);

    const trimmed = value.trim();
    if (!trimmed) return;

    const patch: Record<string, string> = {};

    if (!values.hp_roll) {
      const match = lookupSrd(value);
      if (match) {
        patch.hp_roll = match.hp;
        if (!values.ac) patch.ac = match.ac;
        if (!values.speed) patch.speed = match.speed;
        if (!values.cr) patch.cr = match.cr;
      }
    }

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

  function selectSuggestion(s: Suggestion) {
    if (s.type === 'library') {
      handleSelect(s.npc);
    } else {
      // SRD creature — create in library then open
      handleNew(s.name);
      setSearchQuery('');
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    const totalItems = suggestions.length + (showNewOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        selectSuggestion(suggestions[highlightIdx]);
      } else if (suggestions.length === 1 && !showNewOption) {
        selectSuggestion(suggestions[0]);
      } else if (showNewOption && (highlightIdx === suggestions.length || highlightIdx === -1)) {
        handleNew(searchQuery.trim());
        setSearchQuery('');
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setHighlightIdx(-1);
      searchRef.current?.blur();
    }
  }

  const sh = 'text-[0.7rem] uppercase tracking-[0.18em] text-[var(--color-gold)] mb-2 pb-1.5 border-b border-[var(--color-border)] font-sans';
  const ta = 'w-full bg-transparent border-none text-[var(--color-text-body)] font-serif text-[0.88rem] leading-[1.55] resize-none outline-none min-h-[90px] placeholder:text-[#8a7452]';
  const fi = 'bg-transparent border-none border-b border-[var(--color-border)] text-[var(--color-text)] font-serif text-3xl font-bold outline-none focus:border-b-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5 flex-1';

  const statusText  = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed' }[saveStatus];
  const statusColor = saveStatus === 'saved' ? 'text-[#5a8a5a]' : saveStatus === 'failed' ? 'text-[#c0392b]' : 'text-[var(--color-text-muted)]';

  const showSuggestions = searchFocused && searchQuery.trim() && (suggestions.length > 0 || showNewOption);

  return (
    <div className="max-w-[1000px] mx-auto px-4 pb-16" onClick={() => setActiveId(null)}>

      {/* Search bar with auto-suggest */}
      <div className="relative mb-6" onClick={e => e.stopPropagation()}>
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setHighlightIdx(-1); }}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search NPCs..."
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2
                     text-[var(--color-text)] font-serif text-sm placeholder:text-[var(--color-text-dim)]
                     outline-none focus:border-[var(--color-gold)]"
        />

        {/* Suggestion dropdown */}
        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded shadow-lg">
            {suggestions.map((s, i) => {
              const isLibrary = s.type === 'library';
              const name = isLibrary ? s.npc.name : s.name;
              const cr = isLibrary ? s.npc.cr : s.cr;
              const hpRoll = isLibrary ? s.npc.hp_roll : s.hpRoll;
              const imgUrl = isLibrary && s.npc.image_path ? resolveImageUrl(s.npc.image_path) : null;
              const initial = name.trim() ? name.trim()[0].toUpperCase() : '?';
              const range = hpRoll ? diceRange(hpRoll) : null;
              return (
                <button
                  key={isLibrary ? s.npc.id : `srd-${name}`}
                  onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-3 py-2 transition-colors cursor-pointer border-none"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: i === highlightIdx ? 'rgba(201,168,76,0.15)' : 'transparent',
                  }}
                  onMouseEnter={() => setHighlightIdx(i)}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[#2e2825] flex-shrink-0 flex items-center justify-center"
                    style={{ border: `2px solid ${isLibrary ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.2)'}` }}>
                    {imgUrl
                      ? <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs text-[var(--color-text-muted)] font-serif">{initial}</span>
                    }
                  </div>
                  <span className="font-serif text-sm text-[var(--color-text)] flex-1">{name}</span>
                  {cr && <span className="text-[0.65rem] text-[var(--color-gold)] font-sans uppercase">CR {cr}</span>}
                  {range && <span className="text-[0.65rem] text-[var(--color-text-dim)] font-sans">HP {range.min}–{range.max}</span>}
                </button>
              );
            })}
            {showNewOption && (
              <button
                onClick={() => { handleNew(searchQuery.trim()); setSearchQuery(''); }}
                className="w-full text-left px-3 py-2 transition-colors cursor-pointer border-none"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: highlightIdx === suggestions.length ? 'rgba(201,168,76,0.15)' : 'transparent',
                }}
                onMouseEnter={() => setHighlightIdx(suggestions.length)}
              >
                <div className="w-8 h-8 rounded-full border-2 border-dashed flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: 'rgba(201,168,76,0.4)' }}>
                  <span className="text-sm text-[var(--color-gold)]">+</span>
                </div>
                <span className="font-serif text-sm text-[var(--color-gold)]">Create &ldquo;{searchQuery.trim()}&rdquo;</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recently used bar */}
      {recentNpcs.length > 0 && (
        <div className="mb-6" onClick={e => e.stopPropagation()}>
          <div className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)] font-sans mb-2">
            Recently Used — <span className="text-[var(--color-text-dim)]">option+click to add to session</span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {recentNpcs.map(npc => {
              const imgUrl = npc.image_path ? resolveImageUrl(npc.image_path) : null;
              const initial = npc.name.trim() ? npc.name.trim()[0].toUpperCase() : '?';
              const range = npc.hp_roll ? diceRange(npc.hp_roll) : null;
              const isActive = activeId === npc.id;
              const justAdded = addedFlash === npc.id;
              return (
                <button
                  key={npc.id}
                  onClick={e => {
                    e.stopPropagation();
                    if (e.altKey) { addToSession(npc); }
                    else { handleSelect(npc); }
                  }}
                  className="flex flex-col items-center gap-1 cursor-pointer bg-transparent border-none transition-all"
                  title={`${npc.name}${range ? ` (HP ${range.min}–${range.max})` : ''} — option+click to add to session`}
                >
                  <div
                    className="rounded-full overflow-hidden bg-[#2e2825] flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      width: 56, height: 56,
                      border: justAdded ? '3px solid #2d8a4e' : isActive ? '3px solid var(--color-gold)' : '2px solid rgba(201,168,76,0.3)',
                      boxShadow: justAdded ? '0 0 10px rgba(45,138,78,0.6)' : 'none',
                    }}
                  >
                    {imgUrl
                      ? <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover" />
                      : <span className="text-lg text-[var(--color-text-muted)] font-serif">{initial}</span>
                    }
                  </div>
                  <span className={`text-[0.68rem] font-serif max-w-[64px] truncate text-center ${
                    justAdded ? 'text-[#2d8a4e]' : isActive ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
                  }`}>
                    {justAdded ? 'Added!' : npc.name || 'Unnamed'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!active ? (
        <p className="text-[#5a4a44] font-serif italic text-sm text-center mt-8">
          Search for an NPC or type a name to create one.
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

            {/* HP Roll formula */}
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

            {/* HP Range (read-only, derived from hp_roll) */}
            <HpRangeDisplay hpRoll={values.hp_roll} />

            {/* Gold */}
            {/* Gold with +/- stepper */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-gold)]">Gold</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => { const n = Math.max(0, (parseInt(values.gold, 10) || 0) - 1); handleChange('gold', String(n)); }}
                  className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] transition-colors"
                  style={{ width: 22, height: 20, fontSize: 14, lineHeight: '18px', padding: 0 }}
                >−</button>
                <input
                  value={values.gold}
                  onChange={e => handleChange('gold', e.target.value)}
                  placeholder="0"
                  className="w-12 bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] font-serif text-lg font-bold
                             outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5 text-center"
                />
                <button
                  onClick={() => { const n = (parseInt(values.gold, 10) || 0) + 1; handleChange('gold', String(n)); }}
                  className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] transition-colors"
                  style={{ width: 22, height: 20, fontSize: 14, lineHeight: '18px', padding: 0 }}
                >+</button>
              </div>
            </div>
          </div>

          {/* 2-col content grid */}
          <div className="grid grid-cols-2 border border-[var(--color-border)] border-t-0 rounded-bl-md rounded-br-md overflow-hidden">
            <div className="bg-[var(--color-surface)] border-r border-b border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Attacks</div>
              <textarea rows={5} value={values.attacks} onChange={e => handleChange('attacks', e.target.value)} className={ta} placeholder="Attack names, bonuses, damage…" />
            </div>
            <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Actions</div>
              <textarea rows={5} value={values.actions} onChange={e => handleChange('actions', e.target.value)} className={ta} placeholder="Bonus actions, reactions, legendary actions…" />
            </div>
            <div className="bg-[var(--color-surface)] border-r border-b border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Loot</div>
              <textarea rows={4} value={values.treasure} onChange={e => handleChange('treasure', e.target.value)} className={ta} placeholder="Loot, valuables, magic items…" />
            </div>
            <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Equipment</div>
              <textarea rows={4} value={values.equipment} onChange={e => handleChange('equipment', e.target.value)} className={ta} placeholder="Weapons, armor, gear carried…" />
            </div>
            <div className="bg-[var(--color-surface)] border-r border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
              <div className={sh}>Traits & Abilities</div>
              <textarea rows={5} value={values.traits} onChange={e => handleChange('traits', e.target.value)} className={ta} placeholder="Passive traits, resistances, immunities…" />
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
