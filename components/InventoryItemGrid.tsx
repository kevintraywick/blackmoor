'use client';

import { useEffect, useState } from 'react';
import { resolveImageUrl } from '@/lib/imageUrl';

export interface Item {
  id: number;
  title: string;
  price: number;
  description: string | null;
  stat_type: 'heal' | 'magic' | 'attack' | 'damage' | null;
  stat_value: number | null;
  image_path: string | null;
  in_marketplace: boolean;
  marketplace_qty: number;
  item_type: 'magic_item' | 'scroll' | 'spell' | null;
  attack: number;
  damage: number;
  heal: number;
  rarity: string | null;
  attunement: boolean;
  level: number | null;
  school: string | null;
  casting_time: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  risk_percent: number | null;
}

function statBadgeClass(type: Item['stat_type']): string {
  if (type === 'heal')   return 'bg-red-700 text-white';
  if (type === 'magic')  return 'bg-blue-700 text-green-300';
  if (type === 'attack') return 'bg-neutral-800 text-red-400';
  if (type === 'damage') return 'bg-orange-800 text-orange-200';
  return '';
}

const TYPE_COLORS: Record<string, string> = {
  magic_item: '#7b2d8e',
  scroll: '#6b4f0e',
  spell: '#a88a3a',
};

const TYPE_LABELS: Record<string, string> = {
  magic_item: 'M',
  scroll: 'S',
  spell: '✦',
};

function buildStatLine(item: Item): string {
  const parts: string[] = [];
  if (item.attack > 0) parts.push(`ATK +${item.attack}`);
  if (item.damage > 0) parts.push(`DMG +${item.damage}`);
  if (item.heal > 0) parts.push(`HEAL +${item.heal}`);
  return parts.join(' · ');
}

interface Props {
  refreshKey: number;
  selectedItemId: number | null;
  onSelect: (item: Item) => void;
}

export default function InventoryItemGrid({ refreshKey, selectedItemId, onSelect }: Props) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch('/api/items');
      if (alive && res.ok) {
        const data = await res.json();
        if (alive) setItems(data);
      }
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  if (items.length === 0) {
    return (
      <p className="text-[var(--color-text-dim)] text-sm italic">No items yet.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-6">
      {items.map(item => (
        <div
          key={item.id}
          className="flex flex-col items-center cursor-pointer"
          onClick={() => onSelect(item)}
        >
          {/* Outer wrapper: selection ring + badge positioning context */}
          <div className={`relative group rounded-full transition-all
            ${selectedItemId === item.id
              ? 'ring-2 ring-[var(--color-gold)] ring-offset-2 ring-offset-[#2e3a4a]'
              : ''}`} style={{ width: 58, height: 58 }}>

            {/* Inner circle: clips image and tooltip */}
            <div className="absolute inset-0 rounded-full overflow-hidden border border-[var(--color-border)]">
              {item.image_path ? (
                <img
                  src={resolveImageUrl(item.image_path!)}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[var(--color-surface-raised)]" />
              )}

              {/* Hover tooltip */}
              {item.description && (
                <div className="absolute inset-0 invisible group-hover:visible
                                bg-black/85 flex items-center justify-center p-2
                                text-[10px] text-[var(--color-text)] text-center leading-tight">
                  {item.description}
                </div>
              )}
            </div>

            {/* Gold price badge — bottom-LEFT, coin image bg */}
            <div className="absolute -bottom-1 -left-1 rounded-full
                            overflow-hidden border border-[var(--color-bg)] z-10 flex items-center justify-center"
              style={{ width: 16, height: 16 }}>
              <img src="/images/inventory/gold_coin.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
              <span className="relative text-[6px] font-bold text-black drop-shadow-sm">{item.price}</span>
            </div>

            {/* Type badge — bottom-RIGHT */}
            {item.item_type && TYPE_COLORS[item.item_type] && (
              <div className="absolute -bottom-1 -right-1 rounded-full
                              flex items-center justify-center text-[6px] font-bold text-white
                              border border-[var(--color-bg)] z-10"
                style={{ width: 14, height: 14, backgroundColor: TYPE_COLORS[item.item_type] }}>
                {TYPE_LABELS[item.item_type]}
              </div>
            )}

            {/* Legacy stat badge — bottom-RIGHT, only if no item_type */}
            {!item.item_type && item.stat_type && item.stat_value !== null && (
              item.stat_type === 'heal' ? (
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center z-10" style={{ width: 16, height: 16 }}>
                  <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full drop-shadow-sm" fill="#b91c1c">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  <span className="relative text-[9px] font-bold text-white z-10 leading-none">{item.stat_value}</span>
                </div>
              ) : (
                <div className={`absolute -bottom-1 -right-1 rounded-full
                                flex items-center justify-center text-[6px] font-bold
                                border border-[var(--color-bg)] z-10 ${statBadgeClass(item.stat_type)}`}
                  style={{ width: 16, height: 16 }}>
                  {item.stat_value}
                </div>
              )
            )}
          </div>

          <p className="text-[0.65rem] text-center text-[var(--color-text)] mt-1 w-14 leading-tight line-clamp-2">
            {item.title}
          </p>
          {/* Stat line for items with multiple bonuses */}
          {item.item_type === 'magic_item' && buildStatLine(item) && (
            <p className="text-[0.5rem] text-center text-[var(--color-text-muted)] w-14 leading-tight">
              {buildStatLine(item)}
            </p>
          )}
          {/* Level for scrolls/spells */}
          {(item.item_type === 'scroll' || item.item_type === 'spell') && item.level !== null && (
            <p className="text-[0.5rem] text-center text-[var(--color-text-muted)] w-14 leading-tight">
              Lvl {item.level}{item.school ? ` · ${item.school}` : ''}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
