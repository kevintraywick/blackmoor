'use client';

import { useRef } from 'react';
import type { CardFields } from './CardPreview';
import { resolveImageUrl } from '@/lib/imageUrl';

interface Props {
  fields: CardFields;
  setFields: (update: Partial<CardFields>) => void;
  onFileSelected: (file: File) => void;
  onSubmit: () => void;
  saving: boolean;
  error: string | null;
  suggesting: boolean;
}

type ItemType = 'magic_item' | 'scroll' | 'spell';

const ITEM_TYPES: { value: ItemType; label: string; color: string; activeBg: string }[] = [
  { value: 'magic_item', label: 'Magic Item', color: '#9b59b6', activeBg: '#7b2d8e' },
  { value: 'scroll',     label: 'Scroll',     color: '#8b6914', activeBg: '#6b4f0e' },
  { value: 'spell',      label: 'Spell',      color: '#c9a84c', activeBg: '#a88a3a' },
];

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];

const SCHOOLS = [
  'Abjuration', 'Conjuration', 'Divination', 'Enchantment',
  'Evocation', 'Illusion', 'Necromancy', 'Transmutation',
];

const fieldClass = `bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] font-serif
  outline-none focus:border-[var(--color-gold)] placeholder:text-[#8a7452]`;

function LabeledInput({ label, value, onChange, placeholder, width }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; width?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5" style={width ? { width } : { flex: 1, minWidth: 48 }}>
      <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans">
        {label}
      </span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        className={`${fieldClass} text-center text-[1.1rem] w-full pb-0.5`}
      />
    </div>
  );
}

export default function InventoryCreateForm({ fields, setFields, onFileSelected, onSubmit, saving, error, suggesting }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { itemType, title, description, price, attack, damage, heal, rarity, attunement, level, school, castingTime, range, components, duration, riskPercent, imagePreview, existingImagePath } = fields;

  const imgSrc = imagePreview || (existingImagePath ? resolveImageUrl(existingImagePath) : null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (fileRef.current) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileRef.current.files = dt.files;
      }
      onFileSelected(file);
    }
  }

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-[#1e1b18] relative">
      {/* Suggesting indicator */}
      {suggesting && (
        <div className="absolute inset-0 rounded-md border-2 border-[var(--color-gold)] animate-pulse pointer-events-none z-20" />
      )}

      {/* Type selector */}
      <div className="flex gap-2 px-4 pt-4 pb-3">
        {ITEM_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFields({ itemType: t.value })}
            className="px-3 py-1.5 rounded text-xs font-sans uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: itemType === t.value ? t.activeBg : 'transparent',
              border: `1px solid ${t.color}`,
              color: itemType === t.value ? '#fff' : t.color,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="border-t border-[var(--color-border)]" />

      {/* Card body */}
      <div className="flex flex-col items-center px-5 pt-5 pb-4 gap-4">
        {/* Drop image circle */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="w-28 h-28 rounded-full border-2 border-dashed border-[var(--color-gold)]
                     flex items-center justify-center cursor-pointer overflow-hidden
                     hover:border-[#e0bc5a] transition-colors"
        >
          {imgSrc ? (
            <img src={imgSrc} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[var(--color-gold)] text-[0.6rem] text-center leading-tight px-2">
              Drop image
            </span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file);
          }}
        />

        {/* Title + Level (for scrolls/spells) */}
        <div className="w-full flex items-end gap-2">
          <input
            value={title}
            onChange={e => setFields({ title: e.target.value })}
            required
            placeholder="Item Name"
            className={`${fieldClass} text-xl font-bold text-center pb-1 flex-1`}
          />
          {(itemType === 'scroll' || itemType === 'spell') && (
            <div className="flex flex-col items-center gap-0.5" style={{ width: 50, flexShrink: 0 }}>
              <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans">Lvl</span>
              <input
                value={level}
                onChange={e => setFields({ level: e.target.value })}
                placeholder="0"
                className={`${fieldClass} text-center text-[1.1rem] w-full pb-0.5`}
              />
            </div>
          )}
        </div>

        {/* Type-specific fields */}
        {itemType === 'magic_item' && (
          <div className="w-full flex flex-col gap-3">
            {/* Rarity */}
            <div className="flex flex-col gap-1">
              <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans">
                Rarity
              </span>
              <div className="flex gap-1 flex-wrap">
                {RARITIES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFields({ rarity: rarity === r ? '' : r })}
                    className="px-2.5 py-1 rounded text-[0.65rem] font-sans transition-colors"
                    style={{
                      backgroundColor: rarity === r ? '#4a7a5a' : 'transparent',
                      border: `1px solid ${rarity === r ? '#4a7a5a' : '#5a4f46'}`,
                      color: rarity === r ? '#fff' : '#a89882',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {/* Attunement toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFields({ attunement: !attunement })}
                className="flex items-center justify-center transition-colors"
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${attunement ? '#4a7a5a' : '#5a4f46'}`,
                  backgroundColor: attunement ? '#4a7a5a' : 'transparent',
                  color: '#fff', fontSize: '0.7rem',
                }}
              >
                {attunement ? '✓' : ''}
              </button>
              <span className="text-[0.7rem] text-[var(--color-text-muted)] font-sans">
                Requires Attunement
              </span>
            </div>
          </div>
        )}

        {(itemType === 'scroll' || itemType === 'spell') && (
          <div className="w-full flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans">
                  School
                </span>
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {SCHOOLS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFields({ school: school === s ? '' : s })}
                      className="py-1 rounded text-[0.55rem] font-sans transition-colors text-center"
                      style={{
                        backgroundColor: school === s ? '#4a7a5a' : 'transparent',
                        border: `1px solid ${school === s ? '#4a7a5a' : '#5a4f46'}`,
                        color: school === s ? '#fff' : '#a89882',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {itemType === 'spell' && (
          <div className="w-full grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans">Cast Time</span>
              <input value={castingTime} onChange={e => setFields({ castingTime: e.target.value })}
                placeholder="1 action" className={`${fieldClass} text-sm pb-0.5`} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans">Range</span>
              <input value={range} onChange={e => setFields({ range: e.target.value })}
                placeholder="120 ft" className={`${fieldClass} text-sm pb-0.5`} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans">Components</span>
              <input value={components} onChange={e => setFields({ components: e.target.value })}
                placeholder="V, S, M" className={`${fieldClass} text-sm pb-0.5`} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans">Duration</span>
              <input value={duration} onChange={e => setFields({ duration: e.target.value })}
                placeholder="Instantaneous" className={`${fieldClass} text-sm pb-0.5`} />
            </div>
          </div>
        )}

        {/* Risk + Price row — scrolls and spells */}
        {(itemType === 'scroll' || itemType === 'spell') && (
          <div className="w-full flex gap-2">
            <div className="flex flex-col items-center gap-0.5" style={{ flex: 1, minWidth: 48 }}>
              <span className="text-[0.6rem] uppercase tracking-[0.12em] font-sans" style={{ color: '#b91c1c' }}>
                Risk %
              </span>
              <input
                value={riskPercent}
                onChange={e => setFields({ riskPercent: e.target.value })}
                placeholder="auto"
                className={`${fieldClass} text-center text-[1.1rem] w-full pb-0.5`}
              />
            </div>
            <div className="flex flex-col items-center gap-0.5" style={{ flex: 1, minWidth: 48 }}>
              <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans flex items-center gap-1">
                <img src="/images/inventory/gold_coin.jpg" alt="" className="w-3.5 h-3.5 rounded-full" />
                Price
              </span>
              <input
                value={price}
                onChange={e => setFields({ price: e.target.value })}
                placeholder="0"
                className={`${fieldClass} text-center text-[1.1rem] w-full pb-0.5`}
              />
            </div>
          </div>
        )}

        {/* Description */}
        <textarea
          value={description}
          onChange={e => setFields({ description: e.target.value })}
          rows={2}
          placeholder="Description..."
          className={`${fieldClass} w-full text-sm resize-none border border-[var(--color-border)] rounded px-3 py-2
            bg-[var(--color-surface)] placeholder:text-[var(--color-text-dim)]`}
        />

        {/* Bottom stat row — magic items only */}
        {itemType === 'magic_item' && (
          <div className="w-full border-t border-[var(--color-border)] pt-3">
            <div className="flex gap-2">
              <LabeledInput label="ATK" value={attack} onChange={v => setFields({ attack: v })} placeholder="0" />
              <LabeledInput label="DMG" value={damage} onChange={v => setFields({ damage: v })} placeholder="0" />
              <LabeledInput label="HEAL" value={heal} onChange={v => setFields({ heal: v })} placeholder="0" />
              <div className="flex flex-col items-center gap-0.5" style={{ flex: 1, minWidth: 48 }}>
                <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans flex items-center gap-1">
                  <img src="/images/inventory/gold_coin.jpg" alt="" className="w-3.5 h-3.5 rounded-full" />
                  Price
                </span>
                <input
                  value={price}
                  onChange={e => setFields({ price: e.target.value })}
                  placeholder="0"
                  className={`${fieldClass} text-center text-[1.1rem] w-full pb-0.5`}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="px-5 pb-3 text-red-400 text-xs">{error}</p>
      )}
    </div>
  );
}
