import Image from 'next/image';
import Link from 'next/link';
import DmNav from '@/components/DmNav';
import MarketplaceClient from '@/components/MarketplaceClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import { resolveImageUrl } from '@/lib/imageUrl';

export const dynamic = 'force-dynamic';

interface Item {
  id: number;
  title: string;
  price: number;
  description: string | null;
  stat_type: 'heal' | 'magic' | 'attack' | 'damage' | null;
  stat_value: number | null;
  image_path: string | null;
  marketplace_qty: number;
  item_type: 'magic_item' | 'scroll' | 'spell' | null;
  rarity: string | null;
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

function statBadgeClass(type: Item['stat_type']): string {
  if (type === 'magic')  return 'bg-[#7b2d8e] text-white';
  if (type === 'attack') return 'bg-neutral-800 text-red-400';
  if (type === 'damage') return 'bg-orange-800 text-orange-200';
  return '';
}

interface Props {
  searchParams: Promise<{ player?: string }>;
}

export default async function MarketplacePage({ searchParams }: Props) {
  const { player: playerId } = await searchParams;

  await ensureSchema();
  const players = await getPlayers();
  const player = playerId ? players.find(p => p.id === playerId) : null;
  const items: Item[] = await query(
    'SELECT id, title, price, description, stat_type, stat_value, image_path, marketplace_qty, item_type, rarity FROM items WHERE marketplace_qty > 0 ORDER BY created_at DESC'
  );

  // Fetch player gold if shopping
  let shopperGold = 0;
  if (player) {
    const [row] = await query<{ gold: string }>('SELECT gold FROM player_sheets WHERE id = $1', [player.id]);
    shopperGold = parseInt(row?.gold) || 0;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {player ? (
        <div className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 sm:px-8 py-2 sm:py-3 z-10 text-sm" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] no-underline flex items-center gap-1"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 -mt-px"><path d="M10 3L5 8l5 5" /></svg>Home</Link>
        </div>
      ) : (
        <DmNav current="marketplace" />
      )}

      {/* Full-width banner */}
      <div className="relative w-full h-48 sm:h-64">
        <Image
          src="/images/marketplace/marketplace_banner.png"
          alt="Marketplace"
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      <div className="relative z-10 -mt-[84px] max-w-[1000px] mx-auto px-4 pt-6 pb-16 bg-[var(--color-bg)] rounded-t-2xl">
        <div className="border border-[var(--color-border)] rounded bg-[var(--color-surface)]">

          {player ? (
            /* Player shopping view — Shoppers pane + interactive items */
            <MarketplaceClient
              items={items}
              shopper={{
                id: player.id,
                character: player.character,
                initial: player.initial,
                img: player.img,
                gold: shopperGold,
              }}
            />
          ) : (
            /* DM view — static read-only items */
            <div className="px-4 sm:px-6 pt-5 pb-6 min-h-[320px]">
              <h2 className="font-serif text-[1.1rem] italic text-[var(--color-text-muted)] leading-none tracking-tight mb-4">{items.length} items for sale</h2>
              <div className="border-t border-[var(--color-border)] mb-6" />

              {items.length === 0 ? (
                <p className="text-[var(--color-text-dim)] text-sm italic">No items available.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {items.flatMap(item =>
                    Array.from({ length: item.marketplace_qty }, (_, i) => (
                    <div key={`${item.id}-${i}`} className="flex flex-col items-center">
                      <div className="relative" style={{ width: 80, height: 80 }}>
                        <div className="absolute inset-0 rounded-full overflow-hidden" style={rarityBorderStyle(item.rarity)}>
                          {item.image_path ? (
                            <img src={resolveImageUrl(item.image_path)} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[var(--color-surface-raised)]" />
                          )}
                        </div>
                        <div className="absolute -bottom-1 -left-1 rounded-full overflow-hidden border border-[var(--color-bg)] z-10" style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src="/images/inventory/gold_coin.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
                          <span className="relative text-[9px] font-bold text-black drop-shadow-sm">{item.price}</span>
                        </div>
                        {item.item_type && TYPE_COLORS[item.item_type] && (
                          <div className="absolute -bottom-1 -right-1 rounded-full text-[9px] font-bold text-white border border-[var(--color-bg)] z-10"
                            style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: TYPE_COLORS[item.item_type!] }}>
                            {TYPE_LABELS[item.item_type!]}
                          </div>
                        )}
                        {!item.item_type && item.stat_type && item.stat_value !== null && (
                          item.stat_type === 'heal' ? (
                            <div className="absolute -bottom-1 -right-1 z-10" style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full drop-shadow-sm" fill="#b91c1c">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                              </svg>
                              <span className="relative text-[9px] font-bold text-white z-10 leading-none">{item.stat_value}</span>
                            </div>
                          ) : (
                            <div className={`absolute -bottom-1 -right-1 rounded-full text-[9px] font-bold border border-[var(--color-bg)] z-10 ${statBadgeClass(item.stat_type)}`} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {item.stat_value}
                            </div>
                          )
                        )}
                      </div>
                      <p className="text-[0.65rem] text-center text-[var(--color-text)] mt-1 leading-tight line-clamp-2" style={{ width: 80 }}>
                        {item.title}
                      </p>
                    </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
