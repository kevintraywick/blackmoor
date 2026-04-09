'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { PlayerSheet as PlayerSheetType, WeaponItem, SpellItem, MarketplaceItem, Player, PlayerBoon } from '@/lib/types';
import { useAutosave } from '@/lib/useAutosave';
import type { SaveStatus } from '@/lib/useAutosave';
import { autoFillWeapon, lookupWeapon } from '@/lib/srd-weapons';

// ── Boon list — clickable ☐/☑ lines parsed from stored text ─────────────────
function BoonList({ value, onChange, columns = 1, emptyText }: { value: string; onChange: (v: string) => void; columns?: number; emptyText?: string }) {
  const [editing, setEditing] = useState(false);
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
    setEditing(false);
  }

  return (
    <div>
      <div style={columns > 1 ? { display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, columnGap: '16px' } : undefined}>
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
              <span className={`text-xl leading-none flex-shrink-0 ${isChecked ? 'text-[var(--color-gold)]' : 'text-[#6a5a50]'}`}>
                {isChecked ? '☑' : '☐'}
              </span>
              <span className={`font-serif text-[1.05rem] ${isChecked ? 'text-[#6a5a50] line-through' : 'text-[var(--color-text-body)]'}`}>
                {text}
              </span>
            </div>
          );
        }
        return <div key={i} className="font-serif text-[1.05rem] text-[var(--color-text-body)] py-0.5">{line}</div>;
      })}

      {/* Inline add row — lives in the grid */}
      {editing ? (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-xl leading-none flex-shrink-0 text-[#6a5a50]">☐</span>
          <input
            value={newBoon}
            onChange={e => setNewBoon(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addBoon();
              if (e.key === 'Escape') { setEditing(false); setNewBoon(''); }
            }}
            onBlur={() => { if (!newBoon.trim()) { setEditing(false); setNewBoon(''); } }}
            placeholder=""
            className="flex-1 bg-transparent border-b border-[var(--color-surface-raised)] text-[var(--color-text-body)] font-serif text-[1.05rem] outline-none focus:border-[var(--color-gold)] pb-0.5"
            autoFocus
          />
        </div>
      ) : (
        <div
          className="flex items-center gap-2 py-0.5 cursor-pointer select-none group"
          onClick={() => setEditing(true)}
        >
          <span className="text-lg leading-none flex-shrink-0 text-[#6a5a50] group-hover:text-[var(--color-gold)] transition-colors border border-[#3d3530] rounded w-5 h-5 flex items-center justify-center">+</span>
          <span className="font-serif text-[1.05rem] italic text-[#8a7d6e]">Add item...</span>
        </div>
      )}

      </div>
    </div>
  );
}

// ── Weapon list — name / attack bonus / damage ────────────────────────────────
function WeaponList({
  weapons,
  onAdd,
  onDelete,
  onUpdate,
  scores,
  level,
  className,
}: {
  weapons: WeaponItem[];
  onAdd: (w: Omit<WeaponItem, 'id'>) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: keyof WeaponItem, value: string) => void;
  scores: { str: string; dex: string };
  level: string;
  className: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [atk, setAtk]   = useState('');
  const [dmg, setDmg]   = useState('');
  const [price, setPrice] = useState('');

  function submit() {
    if (!name.trim()) return;
    const srd = autoFillWeapon(name, scores, level, className);
    const finalPrice = price.trim() || srd?.price || '';
    const finalAtk = atk.trim() || srd?.toHit || '';
    const finalDmg = dmg.trim() || srd?.damage || '';
    onAdd({ name: name.trim(), attack_bonus: finalAtk, damage: finalDmg, price: finalPrice });
    setName(''); setAtk(''); setDmg(''); setPrice('');
    setEditing(false);
  }

  const cols = '1fr 50px 50px 86px';
  const rowIn = 'bg-transparent border-none outline-none font-serif text-[1.05rem] w-full';

  return (
    <div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '4px' }} className="text-[0.6rem] uppercase tracking-[0.1em] text-[#6a5a50] pb-1 border-b border-[var(--color-surface-raised)] mb-1.5 font-sans">
        <span>Weapon</span>
        <span className="text-right">Price</span>
        <span className="text-right">To Hit</span>
        <span className="text-right">Damage</span>
      </div>

      {weapons.length === 0 && !editing && (
        <p className="text-[0.8rem] italic text-[#8a7d6e] py-1">No weapons yet</p>
      )}
      {weapons.map(w => (
        <div key={w.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: '4px' }} className="items-center py-[3px]">
          <input value={w.name}         onChange={e => onUpdate(w.id, 'name', e.target.value)}         className={`${rowIn} text-[var(--color-text-body)] truncate`} />
          <input value={w.price ?? ''}  onChange={e => onUpdate(w.id, 'price', e.target.value)}        className={`${rowIn} text-[var(--color-gold)] text-right`} />
          <input value={w.attack_bonus} onChange={e => onUpdate(w.id, 'attack_bonus', e.target.value)} className={`${rowIn} text-[var(--color-gold)] text-right`} />
          <input value={w.damage}       onChange={e => onUpdate(w.id, 'damage', e.target.value)}       className={`${rowIn} text-[var(--color-text-body)] text-right`} />
        </div>
      ))}

      {/* Inline add row */}
      {editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '4px' }} className="items-center py-[3px]">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') { setEditing(false); setName(''); setAtk(''); setDmg(''); setPrice(''); }
            }}
            placeholder=""
            className={`${rowIn} text-[var(--color-text-body)] border-b border-[var(--color-surface-raised)] focus:border-[var(--color-gold)]`}
            autoFocus
          />
          <input
            value={price}
            onChange={e => setPrice(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setEditing(false); setName(''); setAtk(''); setDmg(''); setPrice(''); } }}
            placeholder="0"
            className={`${rowIn} text-[var(--color-gold)] text-right placeholder:text-[#8a7452]`}
          />
          <input
            value={atk}
            onChange={e => setAtk(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setEditing(false); setName(''); setAtk(''); setDmg(''); setPrice(''); } }}
            placeholder="+0"
            className={`${rowIn} text-[var(--color-gold)] text-right placeholder:text-[#8a7452]`}
          />
          <input
            value={dmg}
            onChange={e => setDmg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setEditing(false); setName(''); setAtk(''); setDmg(''); setPrice(''); } }}
            placeholder="1d8+0"
            className={`${rowIn} text-[var(--color-text-body)] text-right placeholder:text-[#8a7452]`}
          />
        </div>
      ) : (
        <div
          className="flex items-center gap-2 py-1 cursor-pointer select-none group mt-1"
          onClick={() => setEditing(true)}
        >
          <span className="text-lg leading-none flex-shrink-0 text-[#6a5a50] group-hover:text-[var(--color-gold)] transition-colors border border-[#3d3530] rounded w-5 h-5 flex items-center justify-center">+</span>
          <span className="font-serif text-[1.05rem] italic text-[#8a7d6e]">Add weapon...</span>
        </div>
      )}
    </div>
  );
}

// ── Spell / magic item list ───────────────────────────────────────────────────
// ── Marketplace item list — purchased items (read-only except delete) ────────
function ItemList({
  items, onDelete,
}: {
  items: MarketplaceItem[];
  onDelete: (id: string) => void;
}) {
  const effect = (item: MarketplaceItem) => {
    if (!item.stat_type || item.stat_value == null) return '';
    return `${item.stat_type.charAt(0).toUpperCase() + item.stat_type.slice(1)} ${item.stat_value}`;
  };
  return (
    <div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 86px', gap: '4px' }} className="text-[0.6rem] uppercase tracking-[0.1em] text-[#6a5a50] pb-1 border-b border-[var(--color-surface-raised)] mb-1.5 font-sans">
        <span>Item</span>
        <span className="text-right">Price</span>
        <span className="text-right">Effect</span>
      </div>

      {items.length === 0 && (
        <p className="text-[0.8rem] italic text-[#8a7d6e] py-1">Visit the Marketplace to acquire items</p>
      )}
      {items.map(item => (
        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 86px', gap: '4px' }} className="items-center py-[3px]">
          <span className="text-[1.05rem] text-[var(--color-text-body)] font-serif truncate">{item.name}</span>
          <span className="text-[1.05rem] text-[var(--color-gold)] font-serif text-right">{item.price}gp</span>
          <span className="text-[1.05rem] text-[var(--color-gold)] font-serif text-right">{effect(item)}</span>
        </div>
      ))}
    </div>
  );
}

function SpellList({
  spells,
  onAdd,
  onDelete,
  onUpdate,
}: {
  spells: SpellItem[];
  onAdd: (s: Omit<SpellItem, 'id'>) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: keyof SpellItem, value: string) => void;
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

  const inputCls = 'flex-1 min-w-0 bg-transparent border-b border-[var(--color-surface-raised)] text-[var(--color-text-body)] font-serif text-[1.05rem] outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5';

  return (
    <div>
      {spells.map((spell, i) => {
        const ri = 'bg-transparent border-none outline-none font-serif';
        return (
          <div key={spell.id}>
            {i > 0 && <div className="h-px bg-[var(--color-surface-raised)] my-1.5" />}
            <div className="flex items-baseline gap-1.5 min-w-0">
              <input value={spell.name}   onChange={e => onUpdate(spell.id, 'name', e.target.value)}   className={`${ri} text-[1.05rem] text-[var(--color-text-body)] flex-1 min-w-0`} placeholder="Spell name…" />
              <input value={spell.effect} onChange={e => onUpdate(spell.id, 'effect', e.target.value)} className={`${ri} text-[1.05rem] text-[var(--color-gold)] w-24 flex-shrink-0 text-right`} placeholder="effect…" />
              <button
                onClick={() => onDelete(spell.id)}
                className="text-[#4a3a35] hover:text-[#8a3a3a] text-[0.65rem] flex-shrink-0 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-wrap gap-x-1 gap-y-0 pl-2.5 mt-0.5 min-w-0">
              <input value={spell.action_type} onChange={e => onUpdate(spell.id, 'action_type', e.target.value)} className={`${ri} text-[0.78rem] text-[#ddd8d2] w-16 flex-shrink-0`} placeholder="action…" />
              <span className="text-[var(--color-border)] text-[0.78rem]">·</span>
              <input value={spell.range}       onChange={e => onUpdate(spell.id, 'range', e.target.value)}       className={`${ri} text-[0.78rem] text-[#ddd8d2] w-14 flex-shrink-0`} placeholder="range…" />
              <span className="text-[var(--color-border)] text-[0.78rem]">·</span>
              <input value={spell.components}  onChange={e => onUpdate(spell.id, 'components', e.target.value)}  className={`${ri} text-[0.78rem] text-[#ddd8d2] w-14 flex-shrink-0`} placeholder="V,S,M…" />
              <span className="text-[var(--color-border)] text-[0.78rem]">·</span>
              <input value={spell.duration}    onChange={e => onUpdate(spell.id, 'duration', e.target.value)}    className={`${ri} text-[0.78rem] text-[#ddd8d2] flex-1 min-w-0`} placeholder="duration…" />
            </div>
          </div>
        );
      })}

      {showForm ? (
        <div className="mt-2 pt-2 border-t border-[var(--color-surface-raised)] flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name…" className={inputCls} />
            <input value={effect} onChange={e => setEffect(e.target.value)} placeholder="Damage / Effect" className="w-24 flex-shrink-0 bg-transparent border-b border-[var(--color-surface-raised)] text-[var(--color-text-body)] font-serif text-[1.05rem] outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5" />
          </div>
          <div className="flex gap-2">
            <input value={actionType}  onChange={e => setActionType(e.target.value)}  placeholder="action / bonus…" className={inputCls} />
            <input value={range}       onChange={e => setRange(e.target.value)}       placeholder="range"           className={inputCls} />
            <input value={components}  onChange={e => setComponents(e.target.value)}  placeholder="V, S, M"         className={inputCls} />
            <input value={duration}    onChange={e => setDuration(e.target.value)}    onKeyDown={e => e.key === 'Enter' && submit()} placeholder="duration" className={inputCls} />
          </div>
          <div className="flex gap-1">
            <button onClick={() => setShowForm(false)} className="text-[0.72rem] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded px-2 py-0.5 hover:border-[var(--color-text-muted)] transition-colors">Cancel</button>
            <button onClick={submit} className="text-[0.72rem] text-[var(--color-text-muted)] border border-[#4a3a35] rounded px-2 py-0.5 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors">Add</button>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 py-1 cursor-pointer select-none group mt-1"
          onClick={() => setShowForm(true)}
        >
          <span className="text-lg leading-none flex-shrink-0 text-[#6a5a50] group-hover:text-[var(--color-gold)] transition-colors border border-[#3d3530] rounded w-5 h-5 flex items-center justify-center">+</span>
          <span className="font-serif text-[1.05rem] italic text-[#8a7d6e]">Add spell...</span>
        </div>
      )}
    </div>
  );
}

// ── A single stat field ──────────────────────────────────────────────────────
function Stat({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-[48px] sm:min-w-[60px]">
      <div className="text-[0.62rem] sm:text-[0.68rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
        {label}
      </div>
      <input
        type="text"
        value={value}
        placeholder="—"
        onChange={e => onChange(e.target.value)}
        className="bg-transparent border-none border-b border-[var(--color-border)] text-[var(--color-text)] text-[1.1rem] text-center outline-none w-full focus:border-b-[var(--color-gold)] placeholder:text-[#8a7452] font-serif pb-0.5"
      />
    </div>
  );
}


// ── Full player sheet form ────────────────────────────────────────────────────
export function Sheet({ playerId, playerName, character, initial, img, data, unreadCount = 0, poisonCount = 0, boonCount = 0, boonUnseen = 0 }: { playerId: string; playerName: string; character: string; initial: string; img?: string; data: PlayerSheetType; unreadCount?: number; poisonCount?: number; boonCount?: number; boonUnseen?: number }) {
  const [values, setValues] = useState<PlayerSheetType>(data);
  const [charName, setCharName] = useState(character);
  const [showMessages, setShowMessages] = useState(false);
  const [showBoons, setShowBoons] = useState(false);
  const [boons, setBoons] = useState<PlayerBoon[]>([]);
  const [boonsSeen, setBoonsSeen] = useState(boonUnseen === 0);
  const [loadingBoons, setLoadingBoons] = useState(false);
  const [messages, setMessages] = useState<{ id: string; message: string; created_at: number }[]>([]);
  const [unread, setUnread] = useState(unreadCount);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const { save: autosave, saveNow, status: saveStatus } = useAutosave(`/api/players/${playerId}`);

  // ── Presence heartbeat — tells the splash page this player is online ───────
  useEffect(() => {
    const beat = () => fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    }).catch(() => {});
    beat(); // immediate first beat
    const id = setInterval(beat, 30_000);
    return () => clearInterval(id);
  }, [playerId]);

  const RECALC_KEYS = new Set(['str', 'dex', 'level', 'class']);

  function recalcWeapons(prev: PlayerSheetType, changedKey: string, changedValue: string): WeaponItem[] | null {
    if (!RECALC_KEYS.has(changedKey)) return null;
    const updated = { ...prev, [changedKey]: changedValue };
    const gear = updated.gear;
    if (!gear || gear.length === 0) return null;

    let changed = false;
    const newGear = gear.map(w => {
      if (!lookupWeapon(w.name)) return w; // not an SRD weapon — leave it alone
      const fill = autoFillWeapon(w.name, { str: updated.str, dex: updated.dex }, updated.level, updated.class);
      if (!fill) return w;
      if (w.attack_bonus === fill.toHit && w.damage === fill.damage) return w; // already correct
      changed = true;
      return { ...w, attack_bonus: fill.toHit, damage: fill.damage };
    });
    return changed ? newGear : null;
  }

  function setField(key: keyof PlayerSheetType, value: PlayerSheetType[keyof PlayerSheetType]) {
    setValues(prev => {
      const next = { ...prev, [key]: value };
      // Recalc SRD weapon stats when ability scores, level, or class change
      const newGear = recalcWeapons(prev, key, value as string);
      if (newGear) {
        next.gear = newGear;
        autosave({ [key]: value, gear: newGear });
        return next;
      }
      autosave({ [key]: value });
      return next;
    });
  }

  // Weapon helpers
  function addWeapon(item: Omit<WeaponItem, 'id'>) {
    setField('gear', [...values.gear, { ...item, id: Date.now().toString(36) }]);
  }
  function deleteWeapon(id: string) {
    setField('gear', values.gear.filter(w => w.id !== id));
  }
  function updateWeapon(id: string, field: keyof WeaponItem, value: string) {
    setField('gear', values.gear.map(w => w.id === id ? { ...w, [field]: value } : w));
  }

  // Spell helpers
  function addSpell(item: Omit<SpellItem, 'id'>) {
    setField('spells', [...(values.spells ?? []), { ...item, id: Date.now().toString(36) }]);
  }
  function deleteSpell(id: string) {
    setField('spells', (values.spells ?? []).filter(s => s.id !== id));
  }
  function updateSpell(id: string, field: keyof SpellItem, value: string) {
    setField('spells', (values.spells ?? []).map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  // Item helpers (purchased marketplace items)
  function deleteItem(id: string) {
    setField('items', (values.items ?? []).filter(i => i.id !== id));
  }

  async function toggleBoons() { if (showBoons) { setShowBoons(false); return; } setShowBoons(true); setLoadingBoons(true); try { const res = await fetch(`/api/boons?player_id=${playerId}`); const d = await res.json(); setBoons(d.active); if (!boonsSeen) { setBoonsSeen(true); fetch('/api/boons', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player_id: playerId, action: 'seen' }) }); } } finally { setLoadingBoons(false); } }

  async function toggleMessages() {
    if (showMessages) {
      setShowMessages(false);
      return;
    }
    setShowMessages(true);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/dm-messages?player_id=${playerId}`);
      const msgs = await res.json();
      setMessages(msgs);
      // Mark as read
      if (unread > 0) {
        setUnread(0);
        fetch('/api/dm-messages/read', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_id: playerId }),
        });
      }
    } finally {
      setLoadingMessages(false);
    }
  }

  const statusText  = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed — check connection' }[saveStatus];
  const statusColor = saveStatus === 'saved' ? 'text-[#5a8a5a]' : saveStatus === 'failed' ? 'text-[#c0392b]' : 'text-[var(--color-text-muted)]';

  const sh = 'text-[0.7rem] uppercase tracking-[0.18em] text-[var(--color-gold)] mb-2 pb-1.5 border-b border-[var(--color-border)] font-sans';
  const ta = 'w-full bg-transparent border-none text-[#ddd4c8] font-serif text-[1.05rem] leading-[1.6] resize-none outline-none min-h-[90px] placeholder:text-[#8a7452] overflow-hidden';
  const taScroll = 'w-full bg-transparent border-none text-[var(--color-text-body)] font-serif text-[1.05rem] leading-[1.6] resize-none outline-none placeholder:text-[#8a7452] overflow-y-auto focus-scrollbar';
  const fi = 'bg-transparent border-none border-b border-[var(--color-border)] text-[var(--color-text)] font-serif text-lg font-bold outline-none focus:border-b-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5';

  return (
    <>
      {/* Save indicator */}
      {saveStatus !== 'idle' && (
        <div className={`fixed bottom-4 right-4 text-xs px-3 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] ${statusColor}`}>
          {statusText}
        </div>
      )}

      {/* Header — portrait + name/class fields */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-tl-md rounded-tr-md px-3 sm:px-4 py-3 border-b-0 relative">
        {/* Mobile: stacked layout. Desktop: single row */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Portrait circle */}
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-[#8b1a1a] bg-[#2e2825] flex items-center justify-center overflow-hidden flex-shrink-0">
            <span className="text-[1.2rem] sm:text-[1.4rem] text-[var(--color-text-muted)] select-none">{initial}</span>
            {img && (
              <Image
                src={img}
                alt={character}
                fill
                className="object-cover absolute inset-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>

          {/* Desktop: single row with name + fields + HP/Gold + action circles */}
          <div className="hidden sm:flex items-center justify-center flex-1 min-w-0">
            <input
              value={charName}
              onChange={e => {
                setCharName(e.target.value);
                clearTimeout((window as unknown as Record<string, unknown>).__charTimer as ReturnType<typeof setTimeout>);
                const val = e.target.value;
                (window as unknown as Record<string, unknown>).__charTimer = setTimeout(() => {
                  fetch(`/api/players/${playerId}/name`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ character: val }),
                  });
                }, 800);
              }}
              className="text-[var(--color-text)] text-xl font-bold font-serif bg-transparent border-none outline-none min-w-0"
              style={{ width: `${Math.max(charName.length + 1, 4)}ch`, marginRight: 16 }}
            />
            <input value={values.species} placeholder="Species…" onChange={e => setField('species', e.target.value)} className={fi} style={{ minWidth: 60, width: 80, marginRight: 12 }} />
            <input value={values.class} placeholder="Class…" onChange={e => setField('class', e.target.value)} className={fi} style={{ minWidth: 60, width: 80 }} />

            {/* HP + Gold group — dead center */}
            <div className="flex items-center" style={{ gap: 20, margin: '0 auto' }}>
              {/* HP */}
              <div className="flex flex-col items-center">
                <svg viewBox="0 0 24 24" fill="#b91c1c" style={{ width: 18, height: 18 }}>
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <input value={values.hp} placeholder="—" onChange={e => setField('hp', e.target.value)} className="bg-transparent border-none text-[var(--color-text)] text-[0.95rem] text-center outline-none font-serif" style={{ width: 36 }} />
              </div>
              {/* Gold */}
              <div className="flex flex-col items-center">
                <img src="/images/inventory/gold_coin.jpg" alt="Gold" style={{ width: 18, height: 18 }} className="rounded-full" />
                <input value={values.gold} placeholder="—" onChange={e => setField('gold', e.target.value)} className="bg-transparent border-none text-[var(--color-text)] text-[0.95rem] text-center outline-none font-serif" style={{ width: 36 }} />
              </div>
            </div>

            {/* Action circles — 3 dots group */}
            <div className="flex items-center" style={{ gap: 5, marginLeft: 20 }}>
              {boonCount > 0 ? (
                <div onClick={toggleBoons} className={`cursor-pointer ${!boonsSeen ? 'animate-pulse' : ''}`} title={`${boonCount} active boon${boonCount > 1 ? 's' : ''}`}>
                  <div style={{ width: 14, height: 14, backgroundColor: '#ffffff', borderRadius: '50%', boxShadow: '0 0 6px rgba(255,255,255,0.5)' }} />
                </div>
              ) : (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #3d3530' }} />
              )}
              {poisonCount > 0 ? (
                <div className="animate-pulse cursor-default" title="Poisoned!">
                  <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#4a7a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '9px', lineHeight: 1 }}>🤢</span>
                  </div>
                </div>
              ) : (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #3d3530' }} />
              )}
              {unread > 0 ? (
                <div onClick={toggleMessages} className="animate-pulse cursor-pointer" title={`${unread} unread message${unread > 1 ? 's' : ''}`}>
                  <div style={{ width: 14, height: 14, backgroundColor: '#dc2626', borderRadius: '50%' }} />
                </div>
              ) : messages.length > 0 ? (
                <div onClick={toggleMessages} className="cursor-pointer hover:opacity-70 transition-opacity" style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#3a2e2e' }} title="View messages" />
              ) : (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #3d3530' }} />
              )}
            </div>
          </div>

          {/* Mobile: stacked layout */}
          <div className="flex flex-col items-center flex-1 min-w-0 sm:hidden">
            <div className="flex items-center gap-2">
              <input
                value={charName}
                onChange={e => {
                  setCharName(e.target.value);
                  clearTimeout((window as unknown as Record<string, unknown>).__charTimer as ReturnType<typeof setTimeout>);
                  const val = e.target.value;
                  (window as unknown as Record<string, unknown>).__charTimer = setTimeout(() => {
                    fetch(`/api/players/${playerId}/name`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ character: val }),
                    });
                  }, 800);
                }}
                className="text-[var(--color-text)] text-lg font-bold font-serif bg-transparent border-none outline-none min-w-0"
                style={{ width: `${Math.max(charName.length + 1, 4)}ch` }}
              />
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <input value={values.species} placeholder="Species…" onChange={e => setField('species', e.target.value)} className={`${fi} min-w-[50px] w-[70px]`} />
              <input value={values.class} placeholder="Class…" onChange={e => setField('class', e.target.value)} className={`${fi} min-w-[50px] w-[70px]`} />
              {/* HP + Gold group — dead center */}
              <div className="flex items-center" style={{ gap: 16, margin: '0 auto' }}>
                {/* HP */}
                <div className="flex flex-col items-center">
                  <svg viewBox="0 0 24 24" fill="#b91c1c" style={{ width: 16, height: 16 }}>
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  <input value={values.hp} placeholder="—" onChange={e => setField('hp', e.target.value)} className="bg-transparent border-none text-[var(--color-text)] text-[0.85rem] text-center outline-none font-serif" style={{ width: 32 }} />
                </div>
                {/* Gold */}
                <div className="flex flex-col items-center">
                  <img src="/images/inventory/gold_coin.jpg" alt="Gold" style={{ width: 16, height: 16 }} className="rounded-full" />
                  <input value={values.gold} placeholder="—" onChange={e => setField('gold', e.target.value)} className="bg-transparent border-none text-[var(--color-text)] text-[0.85rem] text-center outline-none font-serif" style={{ width: 32 }} />
                </div>
              </div>
              {/* Action circles */}
              <div className="flex items-center" style={{ gap: 5, marginLeft: 16 }}>
                {boonCount > 0 ? (
                  <div onClick={toggleBoons} className={`cursor-pointer ${!boonsSeen ? 'animate-pulse' : ''}`} title="Boon active">
                    <div style={{ width: 11, height: 11, backgroundColor: '#ffffff', borderRadius: '50%', boxShadow: '0 0 6px rgba(255,255,255,0.5)' }} />
                  </div>
                ) : (
                  <div style={{ width: 11, height: 11, borderRadius: '50%', border: '1px solid #3d3530' }} />
                )}
                {poisonCount > 0 ? (
                  <div className="animate-pulse cursor-default" title="Poisoned!">
                    <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#4a7a5a' }} />
                  </div>
                ) : (
                  <div style={{ width: 11, height: 11, borderRadius: '50%', border: '1px solid #3d3530' }} />
                )}
                {unread > 0 ? (
                  <div onClick={toggleMessages} className="animate-pulse cursor-pointer" title={`${unread} unread`}>
                    <div style={{ width: 11, height: 11, backgroundColor: '#dc2626', borderRadius: '50%' }} />
                  </div>
                ) : messages.length > 0 ? (
                  <div onClick={toggleMessages} className="cursor-pointer hover:opacity-70 transition-opacity" style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#3a2e2e' }} title="View messages" />
                ) : (
                  <div style={{ width: 11, height: 11, borderRadius: '50%', border: '1px solid #3d3530' }} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SMS opt-in row */}
      <div className="border-x border-[var(--color-border)] bg-[var(--color-surface)] px-3 sm:px-4 py-2">
        <div className="flex items-center gap-3">
          <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest font-sans">SMS push</label>
          <input
            type="checkbox"
            checked={data.sms_optin === true}
            onChange={async e => {
              await fetch('/api/sms/optin', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ playerId, optin: e.target.checked }),
              });
            }}
          />
          <input
            type="tel"
            placeholder="+15551234567"
            defaultValue={data.sms_phone ?? ''}
            onBlur={async e => {
              const phone = e.target.value.trim();
              if (!phone || /^\+\d{8,15}$/.test(phone)) {
                await fetch('/api/sms/optin', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ playerId, optin: data.sms_optin === true, phone }),
                });
              }
            }}
            className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)] font-sans"
          />
        </div>
      </div>

      {/* Boon detail pane */}
      <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: showBoons ? '400px' : '0px', opacity: showBoons ? 1 : 0 }}>
        <div className="border-x border-[var(--color-border)] px-4 py-3 bg-[#1e1d1a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.65rem] uppercase tracking-[0.15em] text-[#e8ddd0] font-sans">Active Boons</span>
            <button onClick={() => setShowBoons(false)} className="text-[#5a4f46] hover:text-[var(--color-text)] text-sm bg-transparent border-none cursor-pointer">✕</button>
          </div>
          {loadingBoons && <p className="text-[#8a7d6e] text-sm font-serif">Loading...</p>}
          {!loadingBoons && boons.length === 0 && <p className="text-[#8a7d6e] text-sm font-serif italic">No active boons</p>}
          {boons.map(b => (<div key={b.id} className="mb-3 last:mb-0"><div className="flex items-center gap-2 mb-0.5"><span className="font-serif text-[1.05rem] text-[var(--color-text)]">{b.name}</span>{b.grants_advantage && <span className="text-[0.5rem] uppercase tracking-wider text-[#c9a84c] font-sans border border-[#c9a84c40] px-1 py-0.5 rounded-sm">Advantage</span>}</div><p className="font-serif text-[0.9rem] text-[var(--color-text-body)] leading-relaxed">{b.description}</p>{b.effect && <p className="text-[0.75rem] text-[var(--color-text-muted)] font-sans mt-1">Effect: {b.effect}</p>}<p className="text-[0.65rem] text-[#5a4f46] font-sans mt-0.5">{b.expiry_type === 'permanent' && 'Until used'}{b.expiry_type === 'long_rest' && 'Until long rest'}{b.expiry_type === 'timer' && `${b.expiry_minutes} min timer`}</p></div>))}
        </div>
      </div>

      {/* DM Message pane */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: showMessages ? '400px' : '0px',
          opacity: showMessages ? 1 : 0,
        }}
      >
        <div
          className="relative border-x border-[var(--color-border)] px-4 py-3"
          style={{
            backgroundImage: 'url(/images/dm_messages/dm_message.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(26,22,20,0.9)' }} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[0.65rem] uppercase tracking-[0.15em] text-[#c05050] font-sans">Messages from the DM</span>
              <button
                onClick={() => setShowMessages(false)}
                className="text-[#5a4f46] hover:text-[var(--color-text)] text-sm bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            {loadingMessages && <p className="text-[#8a7d6e] text-sm font-serif">Loading...</p>}
            {!loadingMessages && messages.length === 0 && <p className="text-[#8a7d6e] text-sm font-serif italic">No messages</p>}
            {messages.map(m => {
              const d = new Date(m.created_at * 1000);
              const time = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              return (
                <div key={m.id} className="mb-2 last:mb-0">
                  <p className="text-[var(--color-text-body)] text-[1.05rem] font-serif leading-relaxed">{m.message}</p>
                  <p className="text-[#5a4f46] text-[0.65rem] font-sans mt-0.5">{time}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats row — 2 rows on mobile, single row on desktop */}
      <div className="bg-[#1e1b18] border border-[var(--color-border)] border-t-0 border-b-0 px-3 sm:px-4 py-2.5">
        <div className="flex gap-2">
          {(['level','xp','speed','size','ac','align'] as const).map(key => (
            <Stat key={key} label={key.toUpperCase()} value={values[key]} onChange={v => setField(key, v)} />
          ))}
        </div>
      </div>

      {/* Abilities row — same format as stats */}
      <div className="bg-[#1e1b18] border border-[var(--color-border)] border-t-0 border-b-0 px-3 sm:px-4 py-2.5">
        <div className="flex gap-2">
          {(['str','dex','con','int','wis','cha'] as const).map(key => (
            <Stat key={key} label={key.toUpperCase()} value={values[key]} onChange={v => setField(key, v)} />
          ))}
        </div>
      </div>

      {/* Content panes — single column mobile, 2×3 grid desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 border border-[var(--color-border)] border-t-0 rounded-bl-md rounded-br-md overflow-hidden">

        {/* 1: Weapons */}
        <div className="sm:border-r border-b border-[var(--color-border)] p-3" style={{ minWidth: 0, overflow: 'hidden', minHeight: 160, background: '#282220' }}>
          <div className={sh} style={{ fontSize: '0.78rem' }}>Weapons</div>
          <WeaponList weapons={values.gear} onAdd={addWeapon} onDelete={deleteWeapon} onUpdate={updateWeapon} scores={{ str: values.str, dex: values.dex }} level={values.level} className={values.class} />
        </div>

        {/* 2: Cantrips and Spells */}
        <div className="border-b border-[var(--color-border)] p-3" style={{ minWidth: 0, overflow: 'hidden', minHeight: 160, background: '#282220' }}>
          <div className={sh} style={{ fontSize: '0.78rem' }}>Cantrips and Spells</div>
          <SpellList spells={values.spells ?? []} onAdd={addSpell} onDelete={deleteSpell} onUpdate={updateSpell} />
        </div>

        {/* 3: Gear */}
        <div className="bg-[var(--color-surface)] sm:border-r border-b border-[var(--color-border)] p-3" style={{ minWidth: 0, minHeight: 120 }}>
          <div className={sh}>Gear</div>
          <BoonList value={values.boons} onChange={v => setField('boons', v)} columns={2} />
        </div>

        {/* 4: Magic Items */}
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-3" style={{ minWidth: 0, overflow: 'hidden', minHeight: 120 }}>
          <div className={sh}>Magic Items</div>
          <ItemList items={values.items ?? []} onDelete={deleteItem} />
        </div>

        {/* Class and Species Abilities */}
        <div className="bg-[var(--color-surface)] sm:border-r border-b sm:border-b-0 border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
          <div className={sh}>Class and Species Abilities</div>
          <textarea rows={2} value={values.class_features} onChange={e => setField('class_features', e.target.value)} className={ta} placeholder="" />
          <textarea rows={2} value={values.player_notes} onChange={e => setField('player_notes', e.target.value)} className={`${ta} mt-2`} placeholder="" />
        </div>

        {/* Background */}
        <div className="bg-[var(--color-surface)] border-[var(--color-border)] p-3 flex flex-col" style={{ minWidth: 0, minHeight: 160 }}>
          <div className={sh}>Background</div>
          <div className="flex-1 overflow-hidden relative">
            <textarea value={values.general_notes} onChange={e => setField('general_notes', e.target.value)} className={`${ta} absolute inset-0`} style={{ overflowY: 'scroll', paddingRight: '20px', width: 'calc(100% + 20px)' }} placeholder="" />
          </div>
        </div>

      </div>
    </>
  );
}

// ── Top-level component: selector row + active sheet ─────────────────────────
export default function PlayerSheets({ players, sheets }: { players: Player[]; sheets: Record<string, PlayerSheetType> }) {
  const firstActive = players.find(p => (sheets[p.id]?.status ?? 'active') !== 'removed')?.id ?? players[0]?.id ?? '';
  const [activeId, setActiveId] = useState<string>(firstActive);

  const activePlayer = players.find(p => p.id === activeId)!;
  const activeData = sheets[activeId];

  return (
    <div className="max-w-[860px] mx-auto px-2 sm:px-4 pb-16">

      {/* Player selector */}
      <div className="flex justify-center gap-2 sm:gap-4 flex-wrap py-4 sm:py-5 bg-[var(--color-surface)] border-b border-[var(--color-border)] -mx-4 px-4 mb-4 sm:mb-6">
        {players.map(p => {
          const status = sheets[p.id]?.status ?? 'active';
          if (status === 'removed') return null;
          const isAway = status === 'away';
          return (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`flex flex-col items-center gap-1 sm:gap-1.5 cursor-pointer bg-transparent border-none transition-opacity ${isAway ? 'opacity-40' : ''}`}
            >
              <div className={`relative w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden border-[3px] transition-all ${
                activeId === p.id
                  ? 'border-[var(--color-gold)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)] hover:scale-105'
              } bg-[#2e2825] flex items-center justify-center`}>
                <span className="text-[1.2rem] sm:text-[1.6rem] text-[var(--color-text-muted)] select-none">{p.initial}</span>
                <Image
                  src={p.img}
                  alt={p.playerName}
                  fill
                  className="object-cover absolute inset-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <span className={`text-[0.65rem] sm:text-[0.72rem] uppercase tracking-[0.1em] transition-colors ${
                activeId === p.id ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
              }`}>
                {p.playerName}{isAway ? ' · away' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active sheet */}
      <Sheet
        key={activeId}
        playerId={activePlayer.id}
        playerName={activePlayer.playerName}
        character={activePlayer.character}
        initial={activePlayer.initial}
        img={activePlayer.img}
        data={activeData}
      />
    </div>
  );
}
