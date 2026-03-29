'use client';

import Link from 'next/link';
import Image from 'next/image';

export type NavSection = 'campaign' | 'sessions' | 'players' | 'npcs' | 'initiative' | 'maps' | 'magic' | 'marketplace' | 'poisons' | 'inventory';

const LINKS: { key: NavSection; label: string; href: string }[] = [
  { key: 'campaign',    label: 'Campaign',         href: '/dm/campaign' },
  { key: 'sessions',    label: 'Sessions',        href: '/dm' },
  { key: 'players',     label: 'Players',         href: '/dm/players' },
  { key: 'npcs',        label: 'NPCs',            href: '/dm/npcs' },
  { key: 'initiative',  label: 'Initiative',      href: '/dm/initiative' },
  { key: 'maps',        label: 'Maps',            href: '/dm/maps' },
  { key: 'magic',       label: 'Magic',           href: '/dm/magic' },
  { key: 'marketplace', label: 'Marketplace',     href: '/dm/marketplace' },
  { key: 'inventory',   label: 'Inventory',       href: '/dm/inventory' },
  { key: 'poisons',     label: 'Poisons & Traps', href: '/dm/poisons' },
];

function ArrowLeft() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 inline-block -mt-px">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

export default function DmNav({ current, sessionId }: { current: NavSection; sessionId?: string }) {
  return (
    <nav className="sticky top-0 bg-[#4a7a5a] backdrop-blur border-b border-[#5a8a6a] px-8 py-2.5 flex items-center gap-4 z-10 text-sm font-serif">
      <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors no-underline flex-shrink-0">
        <div className="relative w-6 h-6 rounded-full border border-white/30 overflow-hidden flex-shrink-0">
          <Image src="/images/dm.png" alt="" fill className="object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <ArrowLeft />
        <span>Home</span>
      </Link>
      {LINKS.map(link => {
        const href = link.key === 'maps' && sessionId ? `/dm/maps?session=${sessionId}` : link.href;
        return link.key === current
          ? <span key={link.key} className="text-white font-semibold">{link.label}</span>
          : <Link key={link.key} href={href} className="text-white/70 hover:text-white transition-colors no-underline">{link.label}</Link>;
      })}
    </nav>
  );
}
