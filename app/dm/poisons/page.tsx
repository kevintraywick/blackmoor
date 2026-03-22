import Link from 'next/link';

export default function PoisonsPage() {
  return (
    <div className="min-h-screen bg-[#1a1614] text-white">
      <div className="sticky top-0 bg-[#231f1c] border-b border-[#3d3530] px-8 py-3 flex items-center gap-3 z-10 text-sm">
        <Link href="/" className="text-white hover:text-[#c9a84c] no-underline">← Home</Link>
        <span className="text-[#3d3530]">|</span>
        <Link href="/dm" className="text-white hover:text-[#c9a84c] no-underline">Sessions</Link>
        <span className="text-[#3d3530]">|</span>
        <span className="text-[#c9a84c] font-bold">Poisons & Traps</span>
        <span className="text-[#3d3530]">|</span>
        <Link href="/players" className="text-white hover:text-[#c9a84c] no-underline">Players</Link>
        <Link href="/dm/maps" className="text-white hover:text-[#c9a84c] no-underline">Maps</Link>
        <Link href="/dm/magic" className="text-white hover:text-[#c9a84c] no-underline">Magic</Link>
        <Link href="/dm/marketplace" className="text-white hover:text-[#c9a84c] no-underline">Marketplace</Link>
      </div>
      <div className="max-w-[640px] mx-auto px-8 py-16 text-center">
        <div className="text-[#c9a84c] text-xs uppercase tracking-[0.18em] mb-4">Poisons & Traps</div>
        <div className="text-white/40 text-sm">Coming soon</div>
      </div>
    </div>
  );
}
