import Image from 'next/image';
import Link from 'next/link';
import DmNav from '@/components/DmNav';
import { PLAYERS } from '@/lib/players';

interface Props {
  searchParams: Promise<{ player?: string }>;
}

export default async function MarketplacePage({ searchParams }: Props) {
  const { player: playerId } = await searchParams;
  const player = playerId ? PLAYERS.find(p => p.id === playerId) : null;

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      {player ? (
        <div className="sticky top-0 bg-[#231f1c] border-b border-[#3d3530] px-8 py-3 flex items-center gap-3 z-10 text-sm">
          <Link href={`/players/${player.id}`} className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">← {player.character}</Link>
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
        <div className="border border-[#3d3530] rounded bg-[#4a2208]">
          {/* Marketplace */}
          <div className="px-6 pt-5 pb-6 min-h-[320px]">
            <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0] leading-none tracking-tight mb-1">Marketplace</h2>
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mb-4">Items for sale from the marketplace</p>
            <div className="border-t border-[#3d3530]" />
          </div>

          {/* Divider */}
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
