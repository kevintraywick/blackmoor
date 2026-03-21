'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { PlayerSheet as PlayerSheetType, GearItem } from '@/lib/types';

// Static player config — things that never change (name, character, portrait path)
export const PLAYERS = [
  { id: 'levi',     playerName: 'LEVI',     character: 'Garrick',  initial: 'L', img: '/images/players/levi.png' },
  { id: 'jeanette', playerName: 'JEANETTE', character: 'Eleil',    initial: 'J', img: '/images/players/jeanette.png' },
  { id: 'nicole',   playerName: 'NICOLE',   character: 'HollyGo',  initial: 'N', img: '/images/players/nicole.png' },
  { id: 'katie',    playerName: 'KATIE',    character: 'Lysandra', initial: 'K', img: '/images/players/katie.png' },
  { id: 'brandon',  playerName: 'BRANDON',  character: 'Vaoker',   initial: 'B', img: '/images/players/brandon.png' },
  { id: 'ashton',   playerName: 'ASHTON',   character: 'Ash',      initial: 'A', img: '/images/players/ashton.png' },
] as const;

type PlayerId = (typeof PLAYERS)[number]['id'];
type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

// Color ring per gear type, matching the original vanilla CSS
const GEAR_RING_COLOR: Record<string, string> = {
  potion: 'border-[#6a8a4a]',
  scroll: 'border-[#4a7a9a]',
  gear:   'border-[#9a7a3a]',
  weapon: 'border-[#8a3a3a]',
};

// ── Gear circle row for one player ──────────────────────────────────────────
function GearCircles({
  gear,
  onAdd,
  onDelete,
}: {
  gear: GearItem[];
  onAdd: (item: Omit<GearItem, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName]     = useState('');
  const [type, setType]     = useState<GearItem['type']>('gear');
  const [qty, setQty]       = useState(1);

  function submit() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), type, qty, value: 0, spellLevel: null });
    setName(''); setType('gear'); setQty(1); setShowForm(false);
  }

  return (
    <div>
      {/* Circles row */}
      <div className="flex flex-wrap gap-3 items-start min-h-[60px]">
        {gear.map(item => {
          // Abbreviate long names to initials inside the circle
          const short = item.name.length > 8
            ? item.name.split(' ').map(w => w[0]).join('').toUpperCase()
            : item.name;
          return (
            <div key={item.id} className="flex flex-col items-center gap-0.5 relative max-w-[64px] group">
              <div className={`w-12 h-12 rounded-full border-2 ${GEAR_RING_COLOR[item.type] ?? 'border-[#9a7a3a]'} flex items-center justify-center bg-[#2e2825] text-[0.68rem] text-[#e8ddd0] text-center leading-tight px-0.5 break-words overflow-hidden`}>
                {short}
              </div>
              <div className="text-[0.65rem] text-[#8a7d6e] text-center max-w-[64px] truncate" title={item.name}>{item.name}</div>
              {item.qty > 1 && (
                <span className="absolute -top-0.5 right-0 bg-[#231f1c] border border-[#3d3530] text-[#8a7d6e] text-[0.6rem] min-w-[16px] px-0.5 h-4 rounded-full flex items-center justify-center">
                  ×{item.qty}
                </span>
              )}
              {/* Delete button — only visible on hover */}
              <button
                onClick={() => onDelete(item.id)}
                className="absolute -top-1 left-0 w-3.5 h-3.5 rounded-full bg-[#3d3530] text-[#8a7d6e] text-[0.5rem] hidden group-hover:flex items-center justify-center hover:bg-[#8b1a1a] hover:text-white"
              >
                ✕
              </button>
            </div>
          );
        })}

        {/* Add button */}
        <button
          onClick={() => setShowForm(v => !v)}
          className="w-12 h-12 rounded-full border-2 border-dashed border-[#3d3530] bg-transparent text-[#8a7d6e] text-xl flex items-center justify-center hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
        >
          +
        </button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="mt-2 p-2 bg-[#1e1b18] rounded text-sm">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Item name…"
            className="w-full bg-transparent border border-[#3d3530] text-[#e8ddd0] rounded px-1.5 py-0.5 mb-1.5 outline-none focus:border-[#c9a84c] text-xs placeholder:text-[#3d3530] font-serif"
          />
          <div className="flex gap-1 mb-1.5">
            <select
              value={type}
              onChange={e => setType(e.target.value as GearItem['type'])}
              className="flex-1 bg-[#1e1b18] border border-[#3d3530] text-[#e8ddd0] rounded px-1 py-0.5 outline-none focus:border-[#c9a84c] text-xs font-serif"
            >
              <option value="potion">Potion</option>
              <option value="scroll">Scroll</option>
              <option value="gear">Gear</option>
              <option value="weapon">Weapon</option>
            </select>
            <input
              type="number"
              value={qty}
              onChange={e => setQty(parseInt(e.target.value) || 1)}
              min={1}
              className="w-12 bg-transparent border border-[#3d3530] text-[#e8ddd0] rounded px-1 py-0.5 outline-none focus:border-[#c9a84c] text-xs text-center font-serif"
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 text-[#8a7d6e] border border-[#3d3530] rounded px-2 py-0.5 text-xs hover:border-[#8a7d6e] font-serif"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              className="flex-1 bg-[#8b1a1a] text-white rounded px-2 py-0.5 text-xs hover:opacity-85 font-serif"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── A single stat with ± buttons ────────────────────────────────────────────
function Stat({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  function adjust(delta: number) {
    const n = parseFloat(value) || 0;
    onChange(String(n + delta));
  }
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-[60px]">
      <div className="text-[0.68rem] uppercase tracking-[0.12em] text-[#8a7d6e]">{label}</div>
      <input
        type="text"
        value={value}
        placeholder="—"
        onChange={e => onChange(e.target.value)}
        className="bg-transparent border-none border-b border-[#3d3530] text-[#e8ddd0] text-[0.95rem] text-center outline-none w-full focus:border-b-[#c9a84c] placeholder:text-[#3d3530] font-serif pb-0.5"
      />
      <div className="flex gap-0.5 mt-0.5">
        {[-1, 1].map(d => (
          <button
            key={d}
            onClick={() => adjust(d)}
            className="w-[22px] h-5 bg-[#2a2420] border border-[#3d3530] text-[#8a7d6e] rounded-sm text-[0.85rem] leading-none hover:border-[#c9a84c] hover:text-[#c9a84c] active:bg-[#3a3020] transition-colors"
          >
            {d === -1 ? '−' : '+'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Full player sheet form ───────────────────────────────────────────────────
function Sheet({
  playerId,
  playerName,
  character,
  initial,
  data,
}: {
  playerId: PlayerId;
  playerName: string;
  character: string;
  initial: string;
  data: PlayerSheetType;
}) {
  const [values, setValues] = useState<PlayerSheetType>(data);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave — fires 600ms after last change
  const autosave = useCallback((patch: Partial<PlayerSheetType>) => {
    setSaveStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/${playerId}`, {
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
  }, [playerId]);

  function setField(key: keyof PlayerSheetType, value: PlayerSheetType[keyof PlayerSheetType]) {
    setValues(prev => ({ ...prev, [key]: value }));
    autosave({ [key]: value });
  }

  // Gear add / remove — updates the whole gear array
  function addGear(item: Omit<GearItem, 'id'>) {
    const newGear = [...values.gear, { ...item, id: Date.now().toString(36) }];
    setField('gear', newGear);
  }
  function deleteGear(id: string) {
    setField('gear', values.gear.filter(g => g.id !== id));
  }

  // Boon textarea click — toggles ☐/☑ near the cursor (same logic as vanilla)
  function handleBoonClick(e: React.MouseEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const pos = ta.selectionStart;
    const text = ta.value;
    const start = Math.max(0, pos - 2);
    const end = Math.min(text.length, pos + 3);
    const surrounding = text.substring(start, end);
    const unchecked = surrounding.indexOf('☐');
    const checked   = surrounding.indexOf('☑');

    let idx = -1, replacement = '';
    if (unchecked !== -1 && (checked === -1 || unchecked <= checked)) {
      idx = start + unchecked; replacement = '☑';
    } else if (checked !== -1) {
      idx = start + checked; replacement = '☐';
    }
    if (idx === -1) return;
    const updated = text.substring(0, idx) + replacement + text.substring(idx + 1);
    setField('boons', updated);
  }

  const statusText  = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed — check connection' }[saveStatus];
  const statusColor = saveStatus === 'saved' ? 'text-[#5a8a5a]' : saveStatus === 'failed' ? 'text-[#c0392b]' : 'text-[#8a7d6e]';

  // Shared textarea style
  const ta = 'w-full bg-transparent border-none text-[#e8ddd0] font-serif text-[0.88rem] leading-[1.55] resize-none outline-none min-h-[90px] placeholder:text-[#4a403a]';

  return (
    <>
      {/* Save indicator (fixed, shared position with session page) */}
      {saveStatus !== 'idle' && (
        <div className={`fixed bottom-4 right-4 text-xs px-3 py-1 rounded border border-[#3d3530] bg-[#231f1c] ${statusColor}`}>
          {statusText}
        </div>
      )}

      {/* Header — player name / character / species · class / discord */}
      <div className="bg-[#231f1c] border border-[#3d3530] rounded-tl-md rounded-tr-md px-4 py-3 border-b-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[#c9a84c] text-xl font-bold tracking-[0.06em]">{playerName}</span>
          <span className="text-[#3d3530]">/</span>
          <span className="text-[#e8ddd0] text-lg font-bold">{character}</span>
          <span className="text-[#3d3530]">/</span>
          <input
            value={values.species}
            placeholder="Species…"
            onChange={e => setField('species', e.target.value)}
            className="bg-transparent border-b border-[#3d3530] text-[#e8ddd0] text-lg font-bold outline-none focus:border-b-[#c9a84c] placeholder:text-[#3d3530] min-w-[70px] w-auto pb-0.5 font-serif"
          />
          <span className="text-[#3d3530]">·</span>
          <input
            value={values.class}
            placeholder="Class…"
            onChange={e => setField('class', e.target.value)}
            className="bg-transparent border-b border-[#3d3530] text-[#e8ddd0] text-lg font-bold outline-none focus:border-b-[#c9a84c] placeholder:text-[#3d3530] min-w-[70px] w-auto pb-0.5 font-serif"
          />
          <span className="text-[#3d3530]">/</span>
          <input
            value={values.discord}
            placeholder="Discord name…"
            onChange={e => setField('discord', e.target.value)}
            className="bg-transparent border-b border-[#3d3530] text-[#e8ddd0] text-lg font-bold outline-none focus:border-b-[#c9a84c] placeholder:text-[#3d3530] flex-1 min-w-[160px] pb-0.5 font-serif"
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-2 flex-wrap bg-[#1e1b18] border border-[#3d3530] border-t-0 border-b-0 px-4 py-2.5">
        {(['level','hp','xp','speed','size','ac'] as const).map(key => (
          <Stat
            key={key}
            label={key.toUpperCase()}
            value={values[key]}
            onChange={v => setField(key, v)}
          />
        ))}
      </div>

      {/* 2×3 content grid */}
      <div className="grid grid-cols-2 border border-[#3d3530] border-t-0 rounded-bl-md rounded-br-md overflow-hidden">
        {/* Boons */}
        <div className="bg-[#231f1c] border-r border-b border-[#3d3530] p-3">
          <div className="text-[0.72rem] uppercase tracking-[0.13em] text-[#8a7d6e] mb-1.5">Boons</div>
          <textarea
            rows={5}
            value={values.boons}
            onChange={e => setField('boons', e.target.value)}
            onClick={handleBoonClick}
            className={ta}
            placeholder="Boon descriptions and checkboxes…"
          />
        </div>

        {/* Gear */}
        <div className="bg-[#231f1c] border-b border-[#3d3530] p-3">
          <div className="text-[0.72rem] uppercase tracking-[0.13em] text-[#8a7d6e] mb-1.5">Gear &amp; Equipment</div>
          <GearCircles gear={values.gear} onAdd={addGear} onDelete={deleteGear} />
        </div>

        {/* Class Features */}
        <div className="bg-[#231f1c] border-r border-b border-[#3d3530] p-3">
          <div className="text-[0.72rem] uppercase tracking-[0.13em] text-[#8a7d6e] mb-1.5">Class Features</div>
          <textarea
            rows={5}
            value={values.class_features}
            onChange={e => setField('class_features', e.target.value)}
            className={ta}
            placeholder="Key class abilities…"
          />
        </div>

        {/* Species Traits */}
        <div className="bg-[#231f1c] border-b border-[#3d3530] p-3">
          <div className="text-[0.72rem] uppercase tracking-[0.13em] text-[#8a7d6e] mb-1.5">Species Traits</div>
          <textarea
            rows={5}
            value={values.species_traits}
            onChange={e => setField('species_traits', e.target.value)}
            className={ta}
            placeholder="Racial/species traits…"
          />
        </div>

        {/* Player Notes */}
        <div className="bg-[#231f1c] border-r border-[#3d3530] p-3">
          <div className="text-[0.72rem] uppercase tracking-[0.13em] text-[#8a7d6e] mb-1.5">Player Notes</div>
          <textarea
            rows={5}
            value={values.player_notes}
            onChange={e => setField('player_notes', e.target.value)}
            className={ta}
            placeholder="Notes about the player…"
          />
        </div>

        {/* General Notes */}
        <div className="bg-[#231f1c] border-[#3d3530] p-3">
          <div className="text-[0.72rem] uppercase tracking-[0.13em] text-[#8a7d6e] mb-1.5">General Notes</div>
          <textarea
            rows={5}
            value={values.general_notes}
            onChange={e => setField('general_notes', e.target.value)}
            className={ta}
            placeholder="Misc notes…"
          />
        </div>
      </div>
    </>
  );
}

// ── Top-level component: selector row + active sheet ─────────────────────────
export default function PlayerSheets({ sheets }: { sheets: Record<string, PlayerSheetType> }) {
  const [activeId, setActiveId] = useState<PlayerId>('levi');

  const activePlayer = PLAYERS.find(p => p.id === activeId)!;
  const activeData = sheets[activeId];

  return (
    <div className="max-w-[780px] mx-auto px-4 pb-16">

      {/* Player selector */}
      <div className="flex justify-center gap-4 flex-wrap py-5 bg-[#231f1c] border-b border-[#3d3530] -mx-4 px-4 mb-6">
        {PLAYERS.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className="flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-none"
          >
            {/* Portrait circle */}
            <div className={`relative w-20 h-20 rounded-full overflow-hidden border-[3px] transition-all ${
              activeId === p.id
                ? 'border-[#c9a84c] shadow-[0_0_0_2px_#c9a84c]'
                : 'border-[#3d3530] hover:border-[#8a7d6e] hover:scale-105'
            } bg-[#2e2825] flex items-center justify-center`}>
              <span className="text-[1.6rem] text-[#8a7d6e] select-none">{p.initial}</span>
              <Image
                src={p.img}
                alt={p.playerName}
                fill
                className="object-cover absolute inset-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <span className={`text-[0.72rem] uppercase tracking-[0.1em] transition-colors ${
              activeId === p.id ? 'text-[#c9a84c]' : 'text-[#8a7d6e]'
            }`}>
              {p.playerName}
            </span>
          </button>
        ))}
      </div>

      {/* Active sheet */}
      <Sheet
        key={activeId}
        playerId={activePlayer.id}
        playerName={activePlayer.playerName}
        character={activePlayer.character}
        initial={activePlayer.initial}
        data={activeData}
      />
    </div>
  );
}
