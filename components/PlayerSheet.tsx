'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { PlayerSheet as PlayerSheetType, WeaponItem, SpellItem, MarketplaceItem, Player } from '@/lib/types';
import { useAutosave } from '@/lib/useAutosave';
import type { SaveStatus } from '@/lib/useAutosave';

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
      {lines.length === 0 && (
        <p className="text-[0.8rem] italic text-[var(--color-text-dim)] py-1">Use + to add a boon or quest reward</p>
      )}
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
              <span className={`font-serif text-[0.88rem] ${isChecked ? 'text-[#6a5a50] line-through' : 'text-[var(--color-text-body)]'}`}>
                {text}
              </span>
            </div>
          );
        }
        return <div key={i} className="font-serif text-[0.88rem] text-[var(--color-text-body)] py-0.5">{line}</div>;
      })}

      <div className="flex gap-2 mt-2 pt-2 border-t border-[var(--color-surface-raised)] items-center">
        <button
          onClick={addBoon}
          className="text-[0.85rem] text-[#6a5a50] hover:text-[var(--color-gold)] bg-transparent border-none transition-colors flex-shrink-0"
        >
          +
        </button>
        <input
          value={newBoon}
          onChange={e => setNewBoon(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addBoon()}
          placeholder=""
          className="flex-1 bg-transparent border-b border-[var(--color-surface-raised)] text-[var(--color-text-body)] font-serif text-[0.82rem] outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5"
        />
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
}: {
  weapons: WeaponItem[];
  onAdd: (w: Omit<WeaponItem, 'id'>) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: keyof WeaponItem, value: string) => void;
}) {
  const [name, setName] = useState('');
  const [atk, setAtk]   = useState('');
  const [dmg, setDmg]   = useState('');

  function submit() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), attack_bonus: atk.trim(), damage: dmg.trim() });
    setName(''); setAtk(''); setDmg('');
  }

  const rowIn = 'bg-transparent border-none outline-none font-serif text-[0.88rem] w-full';

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_50px_70px_16px] gap-1 text-[0.6rem] uppercase tracking-[0.1em] text-[#6a5a50] pb-1 border-b border-[var(--color-surface-raised)] mb-1.5 font-sans">
        <span>Weapon</span>
        <span className="text-center">Atk</span>
        <span className="text-center">Damage</span>
        <span></span>
      </div>

      {weapons.length === 0 && (
        <p className="text-[0.8rem] italic text-[var(--color-text-dim)] py-1">No weapons yet</p>
      )}
      {weapons.map(w => (
        <div key={w.id} className="grid grid-cols-[1fr_50px_70px_16px] gap-1 items-center py-[3px]">
          <input value={w.name}         onChange={e => onUpdate(w.id, 'name', e.target.value)}         className={`${rowIn} text-[var(--color-text-body)] truncate`} />
          <input value={w.attack_bonus} onChange={e => onUpdate(w.id, 'attack_bonus', e.target.value)} className={`${rowIn} text-[var(--color-gold)] text-center`} />
          <input value={w.damage}       onChange={e => onUpdate(w.id, 'damage', e.target.value)}       className={`${rowIn} text-[var(--color-text-body)] text-center`} />
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
        <button
          onClick={submit}
          className="text-[0.85rem] text-[#6a5a50] hover:text-[var(--color-gold)] bg-transparent border-none transition-colors flex-shrink-0"
        >
          +
        </button>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Weapon name…"
          className="flex-1 min-w-0 bg-transparent border-b border-[var(--color-surface-raised)] text-[var(--color-text-body)] font-serif text-[0.82rem] outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5"
        />
        <input
          value={atk}
          onChange={e => setAtk(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="+0"
          className="w-10 text-center flex-shrink-0 bg-transparent border-b border-[var(--color-surface-raised)] text-[var(--color-text-body)] font-serif text-[0.82rem] outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5"
        />
        <input
          value={dmg}
          onChange={e => setDmg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="1d8+0"
          className="w-14 text-center flex-shrink-0 bg-transparent border-b border-[var(--color-surface-raised)] text-[var(--color-text-body)] font-serif text-[0.82rem] outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5"
        />
      </div>
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
  if (items.length === 0) return (
    <p className="text-[0.8rem] italic text-[var(--color-text-dim)] py-1">Visit the Marketplace to acquire items</p>
  );
  const effect = (item: MarketplaceItem) => {
    if (!item.stat_type || item.stat_value == null) return '';
    return `${item.stat_type.charAt(0).toUpperCase() + item.stat_type.slice(1)} ${item.stat_value}`;
  };
  return (
    <div>
      {items.map((item, i) => (
        <div key={item.id}>
          {i > 0 && <div className="h-px bg-[var(--color-surface-raised)] my-1.5" />}
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[0.88rem] text-[var(--color-text-body)] font-serif flex-1 min-w-0 truncate">{item.name}</span>
            {effect(item) && (
              <span className="text-[0.88rem] text-[var(--color-gold)] font-serif w-24 flex-shrink-0 text-right">{effect(item)}</span>
            )}
            <button
              onClick={() => onDelete(item.id)}
              className="text-[#4a3a35] hover:text-[#8a3a3a] text-[0.65rem] flex-shrink-0 transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="text-[0.7rem] text-[#6a5a50] pl-1 mt-0.5">
            {item.price} gp
          </div>
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

  const inputCls = 'flex-1 min-w-0 bg-transparent border-b border-[var(--color-surface-raised)] text-[var(--color-text-body)] font-serif text-[0.82rem] outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5';

  return (
    <div>
      {spells.length === 0 && (
        <p className="text-[0.8rem] italic text-[var(--color-text-dim)] py-1">No spells yet</p>
      )}
      {spells.map((spell, i) => {
        const ri = 'bg-transparent border-none outline-none font-serif';
        return (
          <div key={spell.id}>
            {i > 0 && <div className="h-px bg-[var(--color-surface-raised)] my-1.5" />}
            <div className="flex items-baseline gap-1.5 min-w-0">
              <input value={spell.name}   onChange={e => onUpdate(spell.id, 'name', e.target.value)}   className={`${ri} text-[0.88rem] text-[var(--color-text-body)] flex-1 min-w-0`} placeholder="Spell name…" />
              <input value={spell.effect} onChange={e => onUpdate(spell.id, 'effect', e.target.value)} className={`${ri} text-[0.88rem] text-[var(--color-gold)] w-24 flex-shrink-0 text-right`} placeholder="effect…" />
              <button
                onClick={() => onDelete(spell.id)}
                className="text-[#4a3a35] hover:text-[#8a3a3a] text-[0.65rem] flex-shrink-0 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-1 pl-2.5 mt-0.5 min-w-0">
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
            <input value={effect} onChange={e => setEffect(e.target.value)} placeholder="Damage / Effect" className="w-24 flex-shrink-0 bg-transparent border-b border-[var(--color-surface-raised)] text-[var(--color-text-body)] font-serif text-[0.82rem] outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452] pb-0.5" />
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
        <button
          onClick={() => setShowForm(true)}
          className="mt-2 text-[0.72rem] text-[#6a5a50] hover:text-[var(--color-gold)] bg-transparent border-none transition-colors"
        >
          +
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
  const icon = label === 'GOLD'
    ? <img src="/images/inventory/gold_coin.jpg" alt="" className="absolute top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full pointer-events-none" style={{ right: '100%', marginRight: '4px', marginTop: '-2px' }} />
    : label === 'HP'
    ? <svg viewBox="0 0 24 24" fill="#b91c1c" className="absolute top-1/2 -translate-y-1/2 w-[26px] h-[26px] pointer-events-none" style={{ right: '100%', marginRight: '5px', marginTop: '-1px' }}>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    : null;

  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-[60px]">
      <div className="relative text-[0.68rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
        {icon}
        {label}
      </div>
      <input
        type="text"
        value={value}
        placeholder="—"
        onChange={e => onChange(e.target.value)}
        className="bg-transparent border-none border-b border-[var(--color-border)] text-[var(--color-text)] text-[0.95rem] text-center outline-none w-full focus:border-b-[var(--color-gold)] placeholder:text-[#8a7452] font-serif pb-0.5"
      />
      <div className="flex gap-0.5 mt-0.5">
        {[-1, 1].map(d => (
          <button
            key={d}
            onClick={() => adjust(d)}
            className="w-[22px] h-5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm text-[0.85rem] leading-none hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] active:bg-[#3a3020] transition-colors"
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
  img,
  data,
  unreadCount = 0,
  poisonCount = 0,
}: {
  playerId: string;
  playerName: string;
  character: string;
  initial: string;
  img?: string;
  data: PlayerSheetType;
  unreadCount?: number;
  poisonCount?: number;
}) {
  const [values, setValues] = useState<PlayerSheetType>(data);
  const [showMessages, setShowMessages] = useState(false);
  const [messages, setMessages] = useState<{ id: string; message: string; created_at: number }[]>([]);
  const [unread, setUnread] = useState(unreadCount);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const { save: autosave, saveNow, status: saveStatus } = useAutosave(`/api/players/${playerId}`);

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
  const ta = 'w-full bg-transparent border-none text-[var(--color-text-body)] font-serif text-[1.05rem] leading-[1.6] resize-none outline-none min-h-[90px] placeholder:text-[#8a7452] overflow-hidden';
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
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-tl-md rounded-tr-md px-4 py-3 border-b-0 flex items-center gap-4 relative">
        {/* Portrait circle */}
        <div className="relative w-14 h-14 rounded-full border-2 border-[#8b1a1a] bg-[#2e2825] flex items-center justify-center overflow-hidden flex-shrink-0">
          <span className="text-[1.2rem] text-[var(--color-text-muted)] select-none">{initial}</span>
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

        {/* Name / class fields — all same font, single line */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[var(--color-gold)] text-xl font-bold tracking-[0.06em] font-serif whitespace-nowrap">{playerName}</span>
          <span className="text-[var(--color-border)]">/</span>
          <span className="text-[var(--color-text)] text-xl font-bold font-serif whitespace-nowrap">{character}</span>
          <span className="text-[var(--color-border)]">/</span>
          <input
            value={values.species}
            placeholder="Species…"
            onChange={e => setField('species', e.target.value)}
            className={fi}
            style={{ minWidth: 60, width: 80 }}
          />
          <span className="text-[var(--color-border)]">·</span>
          <input
            value={values.class}
            placeholder="Class…"
            onChange={e => setField('class', e.target.value)}
            className={fi}
            style={{ minWidth: 60, width: 80 }}
          />
          <span className="text-[var(--color-border)]">/</span>
          <input
            value={values.discord}
            placeholder="Discord…"
            onChange={e => setField('discord', e.target.value)}
            className={fi}
            style={{ flex: 1, minWidth: 80 }}
          />

        </div>

        {/* Green poison indicator */}
        {poisonCount > 0 && (
          <div
            className="animate-pulse absolute flex items-center justify-center"
            style={{ right: 79, top: '50%', transform: 'translateY(-50%)', fontSize: '14px', lineHeight: 1 }}
            title="Poisoned!"
          >
            🤢
          </div>
        )}

        {/* Red dot — unread DM messages */}
        {unread > 0 && (
          <div
            onClick={toggleMessages}
            className="animate-pulse cursor-pointer rounded-full absolute"
            style={{ width: 18, height: 18, minWidth: 18, minHeight: 18, backgroundColor: '#dc2626', right: 46, top: '50%', transform: 'translateY(-50%)' }}
            title={`${unread} unread message${unread > 1 ? 's' : ''}`}
          />
        )}
        {unread === 0 && messages.length > 0 && (
          <div
            onClick={toggleMessages}
            className="cursor-pointer rounded-full absolute opacity-40 hover:opacity-70 transition-opacity"
            style={{ width: 14, height: 14, minWidth: 14, minHeight: 14, backgroundColor: '#5a4f46', right: 46, top: '50%', transform: 'translateY(-50%)' }}
            title="View messages"
          />
        )}
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
                  <p className="text-[var(--color-text-body)] text-[0.88rem] font-serif leading-relaxed">{m.message}</p>
                  <p className="text-[#5a4f46] text-[0.65rem] font-sans mt-0.5">{time}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-2 flex-wrap bg-[#1e1b18] border border-[var(--color-border)] border-t-0 border-b-0 px-4 py-2.5">
        {(['level','hp','xp','speed','size','ac','gold'] as const).map(key => (
          <Stat key={key} label={key.toUpperCase()} value={values[key]} onChange={v => setField(key, v)} />
        ))}
      </div>

      {/* 2×3 content grid */}
      <div className="grid grid-cols-2 border border-[var(--color-border)] border-t-0 rounded-bl-md rounded-br-md overflow-hidden">

        {/* 1: Weapons */}
        <div className="bg-[var(--color-surface)] border-r border-b border-[var(--color-border)] p-3" style={{ minWidth: 0, overflow: 'hidden', minHeight: 210 }}>
          <div className={sh}>Weapons</div>
          <WeaponList weapons={values.gear} onAdd={addWeapon} onDelete={deleteWeapon} onUpdate={updateWeapon} />
        </div>

        {/* 2: Magic Spells and Items */}
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-3" style={{ minWidth: 0, overflow: 'hidden', minHeight: 210 }}>
          <div className={sh}>Cantrips and Spells</div>
          <SpellList spells={values.spells ?? []} onAdd={addSpell} onDelete={deleteSpell} onUpdate={updateSpell} />
        </div>

        {/* 3: Gear */}
        <div className="bg-[var(--color-surface)] border-r border-b border-[var(--color-border)] p-3" style={{ minWidth: 0, minHeight: 225 }}>
          <div className={sh}>Gear</div>
          <BoonList value={values.boons} onChange={v => setField('boons', v)} />
        </div>

        {/* 4: Magic Items */}
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-3" style={{ minWidth: 0, overflow: 'hidden', minHeight: 225 }}>
          <div className={sh}>Magic Items</div>
          <ItemList items={values.items ?? []} onDelete={deleteItem} />
        </div>

        {/* Class and Species Abilities */}
        <div className="bg-[var(--color-surface)] border-r border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
          <div className={sh}>Class and Species Abilities</div>
          <textarea rows={2} value={values.class_features} onChange={e => setField('class_features', e.target.value)} className={ta} placeholder="" />
          <textarea rows={2} value={values.player_notes} onChange={e => setField('player_notes', e.target.value)} className={`${ta} mt-2`} placeholder="" />
        </div>

        {/* Background */}
        <div className="bg-[var(--color-surface)] border-[var(--color-border)] p-3" style={{ minWidth: 0 }}>
          <div className={sh}>Background</div>
          <textarea rows={4} value={values.general_notes} onChange={e => setField('general_notes', e.target.value)} className={ta} placeholder="" />
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
    <div className="max-w-[860px] mx-auto px-4 pb-16">

      {/* Player selector */}
      <div className="flex justify-center gap-4 flex-wrap py-5 bg-[var(--color-surface)] border-b border-[var(--color-border)] -mx-4 px-4 mb-6">
        {players.map(p => {
          const status = sheets[p.id]?.status ?? 'active';
          if (status === 'removed') return null;
          const isAway = status === 'away';
          return (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-none transition-opacity ${isAway ? 'opacity-40' : ''}`}
            >
              <div className={`relative w-20 h-20 rounded-full overflow-hidden border-[3px] transition-all ${
                activeId === p.id
                  ? 'border-[var(--color-gold)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)] hover:scale-105'
              } bg-[#2e2825] flex items-center justify-center`}>
                <span className="text-[1.6rem] text-[var(--color-text-muted)] select-none">{p.initial}</span>
                <Image
                  src={p.img}
                  alt={p.playerName}
                  fill
                  className="object-cover absolute inset-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <span className={`text-[0.72rem] uppercase tracking-[0.1em] transition-colors ${
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
