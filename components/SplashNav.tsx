'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Player } from '@/lib/types';

export default function SplashNav({ players }: { players: Player[] }) {
  return (
    <div className="px-4 flex items-start justify-center gap-5 z-10" style={{ background: 'rgba(42,49,64,0.6)', paddingTop: '12px', maxHeight: '110px', overflow: 'visible' }}>

      {/* DM circle */}
      <Link href="/dm" className="flex flex-col items-center gap-1.5 no-underline group" title="Dungeon Master">
        <span className="text-xs uppercase tracking-[0.1em] text-[#6b8fa8] font-sans">DM</span>
        <div className="relative w-24 h-24 rounded-full border-2 border-[#6b8fa8] bg-[rgba(42,49,64,0.7)] flex items-center justify-center overflow-hidden transition-all group-hover:border-[#8ab4cc] group-hover:scale-105">
          <span className="text-[#6b8fa8] text-xl font-bold tracking-wider font-sans">DM</span>
          <Image
            src="/images/dm.png"
            alt="Dungeon Master"
            fill
            className="object-cover absolute inset-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      </Link>

      {/* Divider */}
      <div className="w-px h-20 bg-[var(--color-border)] mx-1 flex-shrink-0" />

      {/* Player circles */}
      {players.map(p => (
        <Link
          key={p.id}
          href={`/players/${p.id}`}
          className="flex flex-col items-center gap-1.5 no-underline group"
          title={p.character}
        >
          <span className="text-xs uppercase tracking-[0.08em] text-[var(--color-text)] font-sans whitespace-nowrap">{p.character}</span>
          <div className="relative w-24 h-24 rounded-full border-2 border-[#8b1a1a] bg-[#2e2825] flex items-center justify-center overflow-hidden transition-all group-hover:border-[#c0392b] group-hover:scale-105">
            <span className="text-[var(--color-text-muted)] text-2xl select-none">{p.initial}</span>
            <Image
              src={p.img}
              alt={p.character}
              fill
              className="object-cover absolute inset-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        </Link>
      ))}

    </div>
  );
}
