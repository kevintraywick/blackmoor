import Image from 'next/image';
import DmNav from '@/components/DmNav';

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <DmNav current="marketplace" />

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

      <div className="max-w-[780px] mx-auto px-8 py-10">
        <h1 className="font-serif text-[2rem] italic text-[#e8ddd0] leading-none tracking-tight">Marketplace</h1>
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mt-1.5 mb-6">
          Goods · Prices · Available Stock
        </p>

        <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0] leading-none tracking-tight mb-1">Shop Inventory</h2>
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mb-4">Items for sale from the marketplace</p>
        <div className="border border-[#3d3530] rounded min-h-[320px] mb-10" />

        <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0] leading-none tracking-tight mb-1">Player Listings</h2>
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mb-4">Items for sale by players</p>
        <div className="border border-[#3d3530] rounded min-h-[320px]" />
      </div>
    </div>
  );
}
