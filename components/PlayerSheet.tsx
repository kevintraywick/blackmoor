'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { PlayerSheet as PlayerSheetType, WeaponItem, SpellItem } from '@/lib/types';
import { PLAYERS } from '@/lib/players';
export { PLAYERS } from '@/lib/players';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

// ── Boon list — clickable ☐/☑ lines parsed from stored text ─────────────────
function BoonList({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [newBoon, setNewBoon] = useState('');
  const lines = value ? value.split('\n') : [];

  function toggleLine(i: number) {
    const updated = [...lines];
    if (updated[i].startsWith('☑')) updated[i] = '☐' + updated[i].slice(1);
    else if (updated[i].startsWith('☐')) updated[i] = '☑' + updated[i].slice(1);
    onChange(updated.join('\n'));
  }

  function addBoon() {
    if (!newBoon.trim()) return;
    const entry = '☐ ' + newBoon.trim();
    onChange(value ? value + '\n' + entry : entry);
    setNewBoon('');
  }

  return (
    <div>
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        const isChecked = line.startsWith('☑');
        const isBox = line.startsWith('☐') || isChecked;
        const text = isBox ? line.slice(1).trim() : line;
        if (isBox) {
          return (
            <div
              key={i}
              className="flex items-center gap-2 py-0.5 cursor-pointer select-none"
              onClick={() => toggleLine(i)}
            >
              <span className={`text-xl leading-none flex-shrink-0 ${isChecked ? 'text-[#c9a84c]' : 'text-[#6a5a50]'}`}>
                {isChecked ? '☑' : '☐'}
              </span>
              <span className={`font-serif text-[0.88rem] ${isChecked ? 'text-[#6a5a50] line-through' : 'text-[#c8bfb5]'}`}>
                {text}
              </span>
            </div>
          );
        }
        return <div key={i} className="font-serif text-[0.88rem] text-[#c8bfb5] py-0.5">{line}</div>;
      })}

      <div className="flex gap-2 mt-2 pt-2 border-t border-[#2a2420] items-center">
        <input
          value={newBoon}
          onChange={e => setNewBoon(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addBoon()}
          placeholder="Add boon…"
          className="flex-1 bg-transparent border-b border-[#2a2420] text-[#c8bfb5] font-serif text-[0.82rem] outline-none focus:border-[#c9a84c] placeholder:text-[#4a403a] pb-0.5"
        />
        <button
          onClick={addBoon}
          className="text-[0.72rem] text-[#8a7d6e] border border-[#4a3a35] rounded px-2 py-0.5 hover:border-[#c9a84c] hover:text-[#c9a84c] flex-shrink-0 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Weapon list — name / attack bonus / damage ────────────────────────────────
function WeaponList({
  weapons,
  onAdd,
  onDelete,
}: {
  weapons: WeaponItem[];
  onAdd: (w: Omit<WeaponItem, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [atk, setAtk]   = useState('');
  const [dmg, setDmg]   = useState('');

  function submit() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), attack_bonus: atk.trim(), damage: dmg.trim() });
    setName(''); setAtk(''); setDmg('');
  }

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_50px_70px_16px] gap-1 text-[0.6rem] uppercase tracking-[0.1em] text-[#6a5a50] pb-1 border-b border-[#2a2420] mb-1.5 font-sans">
        <span>Weapon</span>
        <span className="text-center">Atk</span>
        <span className="text-center">Damage</span>
        <span></span>
      </div>

      {weapons.map(w => (
        <div key={w.id} className="grid grid-cols-[1fr_50px_70px_16px] gap-1 items-center py-[3px]">
          <span className="font-serif text-[0.88rem] text-[#c8bfb5] truncate">{w.name}</span>
          <span className="font-serif text-[0.88rem] text-[#c9a84c] text-center">{w.attack_bonus}</span>
          <span className="font-serif text-[0.88rem] text-[#c8bfb5] text-center">{w.damage}</span>
          <button
            onClick={() => onDelete(w.id)}
            className="text-[#4a3a35] hover:text-[#8a3a3a] text-[0.65rem] text-center transition-colors"
          >
            ✕
          </button>
        </div>
      ))}

      {/* Add row */}
      <div className="flex gap-1 mt-2 items-center">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Weapon name…"
          className="flex-1 min-w-0 bg-transparent border-b border-[#2a2420] text-[#c8bfb5] font-serif text-[0.82rem] outline-none focus:border-[#c9a84c] placeholder:text-[#4a403a] pb-0.5"
        />
        <input
          value={atk}
          onChange={e => setAtk(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="+0"
          className="w-10 text-center flex-shrink-0 bg-transparent border-b border-[#2a2420] text-[#c8bfb5] font-serif text-[0.82rem] outline-none focus:border-[#c9a84c] placeholder:text-[#4a403a] pb-0.5"
        />
        <input
          value={dmg}
          onChange={e => setDmg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="1d8+0"
          className="w-14 text-center flex-shrink-0 bg-transparent border-b border-[#2a2420] text-[#c8bfb5] font-serif text-[0.82rem] outline-none focus:border-[#c9a84c] placeholder:text-[#4a403a] pb-0.5"
        />
        <button
          onClick={submit}
          className="text-[0.72rem] text-[#8a7d6e] border border-[#4a3a35] rounded px-1.5 py-0.5 hover:border-[#c9a84c] hover:text-[#c9a84c] flex-shrink-0 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Spell / magic item list ───────────────────────────────────────────────────
function SpellList({
  spells,
  onAdd,
  onDelete,
}: {
  spells: SpellItem[];
  onAdd: (s: Omit<SpellItem, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm]       = useState(false);
  const [name, setName]               = useState('');
  const [effect, setEffect]           = useState('');
  const [actionType, setActionType]   = useState('');
  const [range, setRange]             = useState('');
  const [components, setComponents]   = useState('');
  const [duration, setDuration]       = useState('');

  function submit() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), effect: effect.trim(), action_type: actionType.trim(), range: range.trim(), components: components.trim(), duration: duration.trim() });
    setName(''); setEffect(''); setActionType(''); setRange(''); setComponents(''); setDuration('');
    setShowForm(false);
  }

  const inputCls = 'flex-1 min-w-0 bg-transparent border-b border-[#2a2420] text-[#c8bfb5] font-serif text-[0.82rem] outline-none focus:border-[#c9a84c] placeholder:text-[#4a403a] pb-0.5';

  return (
    <div>
      {spells.map((spell, i) => {
        const meta = [spell.action_type, spell.range, spell.components, spell.duration].filter(Boolean).join(' · ');
        return (
          <div key={spell.id}>
            {i > 0 && <div className="h-px bg-[#2a2420] my-1.5" />}
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="font-serif text-[0.88rem] text-[#c8bfb5] flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                {spell.name}
              </span>
              {spell.effect && (
                <span className="font-serif text-[0.88rem] text-[#c9a84c] flex-shrink-0">{spell.effect}</span>
              )}
              <button
                onClick={() => onDelete(spell.id)}
                className="text-[#4a3a35] hover:text-[#8a3a3a] text-[0.65rem] flex-shrink-0 transition-colors"
              >
                ✕
              </button>
            </div>
            {meta && (
              <div className="font-serif text-[0.78rem] text-[#ddd8d2] pl-2.5 mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                {meta}
              </div>
            )}
          </div>
        );
      })}

      {showForm ? (
        <div className="mt-2 pt-2 border-t border-[#2a2420] flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name…" className={inputCls} />
            <input value={effect} onChange={e => setEffect(e.target.value)} placeholder="Damage / Effect" className="w-24 flex-shrink-0 bg-transparent border-b border-[#2a2420] text-[#c8bfb5] font-serif text-[0.82rem] outline-none focus:border-[#c9a84c] placeholder:text-[#4a403a] pb-0.5" />
          </div>
          <div className="flex gap-2">
            <input value={actionType}  onChange={e => setActionType(e.target.value)}  placeholder="action / bonus…" className={inputCls} />
            <input value={range}       onChange={e => setRange(e.target.value)}       placeholder="range"           className={inputCls} />
            <input value={components}  onChange={e => setComponents(e.target.value)}  placeholder="V, S, M"         className={inputCls} />
            <input value={duration}    onChange={e => setDuration(e.target.value)}    onKeyDown={e => e.key === 'Enter' && submit()} placeholder="duration" className={inputCls} />
          </div>
          <div className="flex gap-1">
            <button onClick={() => setShowForm(false)} className="text-[0.72rem] text-[#8a7d6e] border border-[#3d3530] rounded px-2 py-0.5 hover:border-[#8a7d6e] transition-colors">Cancel</button>
            <button onClick={submit} className="text-[0.72rem] text-[#8a7d6e] border border-[#4a3a35] rounded px-2 py-0.5 hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors">Add</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-2 text-[0.72rem] text-[#6a5a50] hover:text-[#c9a84c] bg-transparent border-none transition-colors"
        >
          + Add spell or item
        </button>
      )}
    </div>
  );
}

// ── A single stat with ± buttons ──────────────────────────────────────────────
function Stat({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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

// ── Full player sheet form ────────────────────────────────────────────────────
export function Sheet({
  playerId,
  playerName,
  character,
  initial,
  data,
}: {
  playerId: string;
  playerName: string;
  character: string;
  initial: string;
  data: PlayerSheetType;
}) {
  const [values, setValues] = useState<PlayerSheetType>(data);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playerConfig = PLAYERS.find(p => p.id === playerId);

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

  // Weapon helpers
  function addWeapon(item: Omit<WeaponItem, 'id'>) {
    setField('gear', [...values.gear, { ...item, id: Date.now().toString(36) }]);
  }
  function deleteWeapon(id: string) {
    setField('gear', values.gear.filter(w => w.id !== id));
  }

  // Spell helpers
  function addSpell(item: Omit<SpellItem, 'id'>) {
    setField('spells', [...(values.spells ?? []), { ...item, id: Date.now().toString(36) }]);
  }
  function deleteSpell(id: string) {
    setField('spells', (values.spells ?? []).filter(s => s.id !== id));
  }

  const statusText  = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed — check connection' }[saveStatus];
  const statusColor = saveStatus === 'saved' ? 'text-[#5a8a5a]' : saveStatus === 'failed' ? 'text-[#c0392b]' : 'text-[#8a7d6e]';

  const sh = 'text-[0.7rem] uppercase tracking-[0.18em] text-[#c9a84c] mb-2 pb-1.5 border-b border-[#3d3530] font-sans';
  const ta = 'w-full bg-transparent border-none text-[#c8bfb5] font-serif text-[0.88rem] leading-[1.55] resize-none outline-none min-h-[90px] placeholder:text-[#4a403a]';
  const fi = 'bg-transparent border-none border-b border-[#3d3530] text-[#e8ddd0] font-serif text-lg font-bold outline-none focus:border-b-[#c9a84c] placeholder:text-[#3d3530] pb-0.5';

  return (
    <>
      {/* Save indicator */}
      {saveStatus !== 'idle' && (
        <div className={`fixed bottom-4 right-4 text-xs px-3 py-1 rounded border border-[#3d3530] bg-[#231f1c] ${statusColor}`}>
          {statusText}
        </div>
      )}

      {/* Header — portrait + name/class fields */}
      <div className="bg-[#231f1c] border border-[#3d3530] rounded-tl-md rounded-tr-md px-4 py-3 border-b-0 flex items-center gap-4">
        {/* Portrait circle */}
        <div className="relative w-14 h-14 rounded-full border-2 border-[#8b1a1a] bg-[#2e2825] flex items-center justify-center overflow-hidden flex-shrink-0">
          <span className="text-[1.2rem] text-[#8a7d6e] select-none">{initial}</span>
          {playerConfig?.img && (
            <Image
              src={playerConfig.img}
              alt={character}
              fill
              className="object-cover absolute inset-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>

        {/* Name / class fields — all same font, single line */}
        <div className="flex items-baseline gap-2 flex-1 min-w-0 overflow-hidden">
          <span className="text-[#c9a84c] text-xl font-bold tracking-[0.06em] font-serif whitespace-nowrap">{playerName}</span>
          <span className="text-[#3d3530]">/</span>
          <span className="text-[#e8ddd0] text-xl font-bold font-serif whitespace-nowrap">{character}</span>
          <span className="text-[#3d3530]">/</span>
          <input
            value={values.species}
            placeholder="Species…"
            onChange={e => setField('species', e.target.value)}
            className={fi}
            style={{ minWidth: 60, width: 80 }}
          />
          <span className="text-[#3d3530]">·</span>
          <input
            value={values.class}
            placeholder="Class…"
            onChange={e => setField('class', e.target.value)}
            className={fi}
            style={{ minWidth: 60, width: 80 }}
          />
          <span className="text-[#3d3530]">/</span>
          <input
            value={values.discord}
            placeholder="Discord…"
            onChange={e => setField('discord', e.target.value)}
            className={fi}
            style={{ flex: 1, minWidth: 80 }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-2 flex-wrap bg-[#1e1b18] border border-[#3d3530] border-t-0 border-b-0 px-4 py-2.5">
        {(['level','hp','xp','speed','size','ac'] as const).map(key => (
          <Stat key={key} label={key.toUpperCase()} value={values[key]} onChange={v => setField(key, v)} />
        ))}
      </div>

      {/* 2×3 content grid */}
      <div className="grid grid-cols-2 border border-[#3d3530] border-t-0 rounded-bl-md rounded-br-md overflow-hidden">

        {/* Boons */}
        <div className="bg-[#231f1c] border-r border-b border-[#3d3530] p-3" style={{ minWidth: 0 }}>
          <div className={sh}>Boons</div>
          <BoonList value={values.boons} onChange={v => setField('boons', v)} />
        </div>

        {/* Weapons */}
        <div className="bg-[#231f1c] border-b border-[#3d3530] p-3" style={{ minWidth: 0, overflow: 'hidden' }}>
          <div className={sh}>Weapons</div>
          <WeaponList weapons={values.gear} onAdd={addWeapon} onDelete={deleteWeapon} />
        </div>

        {/* Class Features */}
        <div className="bg-[#231f1c] border-r border-b border-[#3d3530] p-3" style={{ minWidth: 0 }}>
          <div className={sh}>Class Features</div>
          <textarea rows={5} value={values.class_features} onChange={e => setField('class_features', e.target.value)} className={ta} placeholder="Key class abilities…" />
        </div>

        {/* Magic Spells or Items */}
        <div className="bg-[#231f1c] border-b border-[#3d3530] p-3" style={{ minWidth: 0, overflow: 'hidden' }}>
          <div className={sh}>Magic Spells or Items</div>
          <SpellList spells={values.spells ?? []} onAdd={addSpell} onDelete={deleteSpell} />
        </div>

        {/* Species Notes (was: Player Notes) */}
        <div className="bg-[#231f1c] border-r border-[#3d3530] p-3" style={{ minWidth: 0 }}>
          <div className={sh}>Species Notes</div>
          <textarea rows={5} value={values.player_notes} onChange={e => setField('player_notes', e.target.value)} className={ta} placeholder="Species traits and abilities…" />
        </div>

        {/* Background (was: General Notes) */}
        <div className="bg-[#231f1c] border-[#3d3530] p-3" style={{ minWidth: 0 }}>
          <div className={sh}>Background</div>
          <textarea rows={5} value={values.general_notes} onChange={e => setField('general_notes', e.target.value)} className={ta} placeholder="Character background…" />
        </div>

      </div>
    </>
  );
}

// ── Top-level component: selector row + active sheet ─────────────────────────
export default function PlayerSheets({ sheets }: { sheets: Record<string, PlayerSheetType> }) {
  const [activeId, setActiveId] = useState<string>('levi');

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
            <div className={`relative w-20 h-20 rounded-full overflow-hidden border-[3px] transition-all ${
              activeId === p.id
                ? 'border-[#c9a84c]'
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
