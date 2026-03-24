import Image from 'next/image';
import Link from 'next/link';
import DmNav from '@/components/DmNav';
import { PLAYERS } from '@/lib/players';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

interface Item {
  id: number;
  title: string;
  price: number;
  description: string | null;
  stat_type: 'heal' | 'magic' | 'attack' | 'damage' | null;
  stat_value: number | null;
  image_path: string | null;
}

function itemImageSrc(path: string): string {
  return path.startsWith('uploads/') ? `/api/${path}` : `/${path}`;
}

function statBadgeClass(type: Item['stat_type']): string {
  if (type === 'magic')  return 'bg-blue-700 text-green-300';
  if (type === 'attack') return 'bg-neutral-800 text-red-400';
  if (type === 'damage') return 'bg-orange-800 text-orange-200';
  return '';
}

interface Props {
  searchParams: Promise<{ player?: string }>;
}

export default async function MarketplacePage({ searchParams }: Props) {
  const { player: playerId } = await searchParams;
  const player = playerId ? PLAYERS.find(p => p.id === playerId) : null;

  await ensureSchema();
  const items: Item[] = await query(
    'SELECT * FROM items WHERE in_marketplace = true ORDER BY created_at DESC'
  );

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      {player ? (
        <div className="sticky top-0 bg-[#231f1c] border-b border-[#3d3530] px-8 py-3 flex items-center gap-3 z-10 text-sm">
          <Link href="/" className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">← Home</Link>
          <span className="text-[#3d3530]">|</span>
          <Link href={`/players/${player.id}`} className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">{player.character}</Link>
          <span className="text-[#3d3530]">|</span>
          <Link href="/" className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">All Players</Link>
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

      <div className="relative z-10 -mt-[84px] max-w-[780px] mx-auto px-4 pt-6 pb-16 bg-[#1a1614] rounded-t-2xl">
        <div className="border border-[#3d3530] rounded bg-[#2e3a4a]">
          {/* Marketplace items */}
          <div className="px-6 pt-5 pb-6 min-h-[320px]">
            <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0] leading-none tracking-tight mb-1">Marketplace</h2>
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mb-4">Items for sale from the marketplace</p>
            <div className="border-t border-[#3d3530] mb-6" />

            {items.length === 0 ? (
              <p className="text-[#5a4f46] text-sm italic">No items available.</p>
            ) : (
              <div className="flex flex-wrap gap-6">
                {items.map(item => (
                  <div key={item.id} className="flex flex-col items-center">
                    <div className="relative w-24 h-24">
                      {/* Circle image */}
                      <div className="absolute inset-0 rounded-full overflow-hidden border border-[#3d3530]">
                        {item.image_path ? (
                          <img src={itemImageSrc(item.image_path)} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#2a2420]" />
                        )}
                      </div>

                      {/* Gold price badge — bottom-left */}
                      <div className="absolute -bottom-1 -left-1 w-[26px] h-[26px] rounded-full
                                      overflow-hidden border border-[#1a1614] z-10 flex items-center justify-center">
                        <img src="/images/inventory/gold_coin.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <span className="relative text-[9px] font-bold text-black drop-shadow-sm">{item.price}</span>
                      </div>

                      {/* Stat badge — bottom-right */}
                      {item.stat_type && item.stat_value !== null && (
                        item.stat_type === 'heal' ? (
                          <div className="absolute -bottom-1 -right-1 w-[26px] h-[26px] flex items-center justify-center z-10">
                            <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full drop-shadow-sm" fill="#b91c1c">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            <span className="relative text-[9px] font-bold text-white z-10 leading-none">{item.stat_value}</span>
                          </div>
                        ) : (
                          <div className={`absolute -bottom-1 -right-1 w-[26px] h-[26px] rounded-full
                                          flex items-center justify-center text-[9px] font-bold
                                          border border-[#1a1614] z-10 ${statBadgeClass(item.stat_type)}`}>
                            {item.stat_value}
                          </div>
                        )
                      )}
                    </div>

                    <p className="text-[0.65rem] text-center text-[#e8ddd0] mt-1 w-24 leading-tight line-clamp-2">
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#3d3530]" />

          {/* Player Listings */}
          <div className="px-6 pt-5 pb-6 min-h-[320px]">
            <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0] leading-none tracking-tight mb-1">Player Listings</h2>
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mb-4">Items for sale by players</p>
            <div className="border-t border-[#3d3530]" />
          </div>
        </div>
      </div>
    </div>
  );
}
