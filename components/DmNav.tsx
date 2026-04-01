'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type NavSection = 'campaign' | 'sessions' | 'players' | 'npcs' | 'initiative' | 'maps' | 'magic' | 'marketplace' | 'poisons' | 'inventory' | 'boons' | 'journey';

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
  { key: 'boons',       label: 'Boons',           href: '/dm/boons' },
  { key: 'journey',     label: 'Journey',         href: '/dm/journey' },
];

function ArrowLeft() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 inline-block -mt-px">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

export default function DmNav({ current, sessionId, poisonCount: initialPoisonCount }: { current: NavSection; sessionId?: string; poisonCount?: number }) {
  const [poisonCount, setPoisonCount] = useState(initialPoisonCount ?? 0);

  useEffect(() => {
    if (initialPoisonCount !== undefined) return; // already provided by server
    fetch('/api/poison').then(r => r.json()).then((rows: unknown[]) => setPoisonCount(rows.length)).catch(() => {});
  }, [initialPoisonCount]);

  return (
    <nav className="sticky top-0 bg-[#161d18] backdrop-blur border-b border-[#4a7a5a]/40 px-8 py-2.5 flex items-center z-10 text-sm font-serif relative">
      <Link href="/" className="flex items-center text-[#4a8a5a] hover:text-[#5ab87a] transition-colors no-underline flex-shrink-0">
        <div className="relative rounded-full border border-[#4a7a5a] overflow-hidden flex-shrink-0" style={{ width: 30, height: 30 }}>
          <Image src="/images/dm.png" alt="" fill className="object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      </Link>
      <div className="flex-1 flex justify-center gap-4 flex-wrap">
      {LINKS.map(link => {
        const href = link.key === 'maps' && sessionId ? `/dm/maps?session=${sessionId}` : link.href;
        const isPoisonGlow = link.key === 'poisons' && poisonCount > 0 && current !== 'poisons';
        return link.key === current
          ? <span key={link.key} className="text-[#5ab87a] font-semibold">{link.label}</span>
          : <Link key={link.key} href={href} className={`transition-colors no-underline ${isPoisonGlow ? 'text-[#7ac28a] animate-pulse' : 'text-[#4a8a5a] hover:text-[#5ab87a]'}`}>{link.label}</Link>;
      })}
      </div>
    </nav>
  );
}
