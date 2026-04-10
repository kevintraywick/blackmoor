'use client';

import { useState } from 'react';
import Link from 'next/link';
import { resolveImageUrl } from '@/lib/imageUrl';

interface Item {
  id: number;
  title: string;
  price: number;
  stat_type: 'heal' | 'magic' | 'attack' | 'damage' | null;
  stat_value: number | null;
  image_path: string | null;
  marketplace_qty: number;
  item_type: 'magic_item' | 'scroll' | 'spell' | null;
  rarity: string | null;
}

interface Shopper {
  id: string;
  character: string;
  initial: string;
  img: string;
  gold: number;
}

function statBadgeClass(type: Item['stat_type']): string {
  if (type === 'magic')  return 'bg-[#7b2d8e] text-white';
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

function rarityBorderStyle(rarity: string | null): React.CSSProperties {
  switch (rarity?.toLowerCase()) {
    case 'uncommon': return { border: '2px solid #2d8a4e' };
    case 'rare': return { border: '2px solid #2563eb' };
    case 'very rare': return { border: '2px solid #7b2d8e' };
    case 'legendary': return { border: '2px solid #c9a84c', boxShadow: '0 0 8px rgba(201,168,76,0.4)' };
    default: return { border: '2px solid #5a4f46' };
  }
}

export default function MarketplaceClient({
  items: initialItems, shopper: initialShopper,
}: {
  items: Item[]; shopper: Shopper;
}) {
  const [items, setItems] = useState(initialItems);
  const [gold, setGold] = useState(initialShopper.gold);
  const [buying, setBuying] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<Item | null>(null);

  function handleItemClick(item: Item) {
    if (buying) return;
    if (gold < item.price) {
      setFlash('Not enough gold!');
      setTimeout(() => setFlash(null), 2000);
      return;
    }
    setConfirmItem(item);
  }

  async function purchase(item: Item) {
    setBuying(true);
    setConfirmItem(null);
    try {
      const res = await fetch('/api/marketplace/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, player_id: initialShopper.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFlash(data.error || 'Purchase failed');
        setTimeout(() => setFlash(null), 2500);
        return;
      }
      const data = await res.json();
      setGold(parseInt(data.gold));
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, marketplace_qty: i.marketplace_qty - 1 } : i
      ).filter(i => i.marketplace_qty > 0));
      setFlash(`Bought ${item.title}!`);
      setTimeout(() => setFlash(null), 2500);
    } finally {
      setBuying(false);
    }
  }

  return (
    <>
      {/* Shoppers bar */}
      <div className="px-6 pt-4 pb-3 border-b border-[var(--color-border)] flex items-center gap-4">
        <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Shoppers</div>

        {/* Player circle */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-[var(--color-gold)] bg-[#2e2825]">
            <img src={initialShopper.img} alt={initialShopper.character}
              className="w-full h-full object-cover absolute inset-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="absolute inset-0 flex items-center justify-center text-sm text-[var(--color-text-muted)] select-none">
              {initialShopper.initial}
            </span>
          </div>
          <span className="text-[0.6rem] uppercase tracking-[0.08em] text-[var(--color-gold)]">
            {initialShopper.character}
          </span>
          <span className="text-[0.5rem] text-[#8a7452] leading-none">{gold} gp</span>
        </div>

        <div className="flex-1" />

        {/* Exit */}
        <Link href={`/players/${initialShopper.id}`}
          className="w-10 h-10 rounded-full border-2 border-white/80 flex items-center justify-center
                     text-white text-base hover:bg-white/10 no-underline transition-colors -ml-5"
          title="Exit marketplace">
          →
        </Link>
      </div>

      {/* Flash message */}
      {flash && (
        <div className={`px-6 py-1.5 text-xs font-serif ${
          flash.includes('Bought') ? 'text-[#5a8a5a]' : 'text-[#c0392b]'
        }`}>
          {flash}
        </div>
      )}

      {/* Marketplace items — clickable */}
      <div className="px-6 pt-5 pb-6 min-h-[320px]">
        <h2 className="font-serif text-[1.3rem] italic text-[var(--color-text)] leading-none tracking-tight mb-1">Marketplace</h2>
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)] mb-4">Click an item to buy</p>
        <div className="border-t border-[var(--color-border)] mb-6" />

        {items.length === 0 ? (
          <p className="text-[var(--color-text-dim)] text-sm italic">No items available.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {items.flatMap(item =>
              Array.from({ length: item.marketplace_qty }, (_, i) => {
                const isConfirming = confirmItem?.id === item.id;
                return (
                <button key={`${item.id}-${i}`} type="button"
                  onClick={() => !isConfirming && handleItemClick(item)} disabled={buying}
                  className="flex flex-col items-center bg-transparent border-none cursor-pointer group p-0">
                  <div className="relative w-24 h-24 transition-transform group-hover:scale-105">
                    <div className="absolute inset-0 rounded-full overflow-hidden" style={rarityBorderStyle(item.rarity)}>
                      {item.image_path ? (
                        <img src={resolveImageUrl(item.image_path)} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[var(--color-surface-raised)]" />
                      )}
                    </div>
                    {/* Gold price badge */}
                    <div className="absolute -bottom-1 -left-1 w-[26px] h-[26px] rounded-full overflow-hidden border border-[var(--color-bg)] z-10 flex items-center justify-center">
                      <img src="/images/inventory/gold_coin.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <span className="relative text-[9px] font-bold text-black drop-shadow-sm">{item.price}</span>
                    </div>
                    {/* Type badge */}
                    {item.item_type && TYPE_COLORS[item.item_type] && (
                      <div className="absolute -bottom-1 -right-1 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-[var(--color-bg)] z-10"
                        style={{ backgroundColor: TYPE_COLORS[item.item_type!] }}>
                        {TYPE_LABELS[item.item_type!]}
                      </div>
                    )}
                    {/* Legacy stat badge — only if no item_type */}
                    {!item.item_type && item.stat_type && item.stat_value !== null && (
                      item.stat_type === 'heal' ? (
                        <div className="absolute -bottom-1 -right-1 w-[26px] h-[26px] flex items-center justify-center z-10">
                          <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full drop-shadow-sm" fill="#b91c1c">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                          </svg>
                          <span className="relative text-[9px] font-bold text-white z-10 leading-none">{item.stat_value}</span>
                        </div>
                      ) : (
                        <div className={`absolute -bottom-1 -right-1 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold border border-[var(--color-bg)] z-10 ${statBadgeClass(item.stat_type)}`}>
                          {item.stat_value}
                        </div>
                      )
                    )}
                  </div>
                  {isConfirming ? (
                    <div className="flex flex-col items-center mt-1 w-24">
                      <p className="text-[0.6rem] text-center text-[var(--color-text)] leading-tight mb-1">
                        Buy for {item.price} gold?
                      </p>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); purchase(item); }}
                          className="text-[0.6rem] uppercase font-sans cursor-pointer"
                          style={{ backgroundColor: '#c9a84c', color: '#000', borderRadius: 9999, padding: '2px 12px' }}>
                          Yes
                        </span>
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmItem(null); }}
                          className="text-[0.6rem] uppercase font-sans text-[var(--color-text-muted)] cursor-pointer"
                          style={{ border: '1px solid var(--color-border)', borderRadius: 9999, padding: '2px 12px' }}>
                          No
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[0.65rem] text-center text-[var(--color-text)] mt-1 w-24 leading-tight line-clamp-2 group-hover:text-[var(--color-gold)] transition-colors">
                      {item.title}
                    </p>
                  )}
                </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}
