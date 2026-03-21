'use client';

import Link from 'next/link';
import Image from 'next/image';
import { PLAYERS } from '@/lib/players';

export default function SplashNav() {
  return (
    <div className="bg-[#231f1c]/90 backdrop-blur border-b border-[#3d3530] px-4 py-2 flex items-center justify-center gap-3 z-10">

      {/* DM circle */}
      <Link href="/dm" className="flex flex-col items-center gap-1 no-underline group" title="Dungeon Master">
        <div className="w-12 h-12 rounded-full border-2 border-[#6b8fa8] bg-[rgba(42,49,64,0.7)] flex items-center justify-center transition-all group-hover:border-[#8ab4cc] group-hover:scale-105">
          <span className="text-[#6b8fa8] text-xs font-bold tracking-wider font-sans">DM</span>
        </div>
        <span className="text-[0.5rem] uppercase tracking-[0.1em] text-[#6b8fa8] font-sans">DM</span>
      </Link>

      {/* Divider */}
      <div className="w-px h-10 bg-[#3d3530] mx-1 flex-shrink-0" />

      {/* Player circles */}
      {PLAYERS.map(p => (
        <Link
          key={p.id}
          href={`/players/${p.id}`}
          className="flex flex-col items-center gap-1 no-underline group"
          title={p.character}
        >
          <div className="relative w-12 h-12 rounded-full border-2 border-[#8b1a1a] bg-[#2e2825] flex items-center justify-center overflow-hidden transition-all group-hover:border-[#c0392b] group-hover:scale-105">
            <span className="text-[#8a7d6e] text-sm select-none">{p.initial}</span>
            <Image
              src={p.img}
              alt={p.character}
              fill
              className="object-cover absolute inset-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <span className="text-[0.5rem] uppercase tracking-[0.08em] text-[#8a7d6e] font-sans whitespace-nowrap">{p.character}</span>
        </Link>
      ))}

      {/* Add player — placeholder */}
      <div className="flex flex-col items-center gap-1">
        <button
          disabled
          title="Add new player (coming soon)"
          className="w-10 h-10 rounded-full border-2 border-dashed border-[#3d3530] bg-transparent text-[#3d3530] text-lg flex items-center justify-center cursor-not-allowed"
        >
          +
        </button>
        <span className="text-[0.5rem] uppercase tracking-[0.08em] text-[#2a2420] font-sans">Add</span>
      </div>
    </div>
  );
}
