'use client'; // needs onClick (browser-only)

import Link from 'next/link';
import Image from 'next/image';
import type { Player } from '@/lib/types';

function PlayerCircle({ player }: { player: Player }) {
  return (
    <Link
      href="/players"
      className="flex flex-col items-center gap-1 no-underline"
    >
      {/* Portrait circle with fallback initial */}
      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[var(--color-border)] bg-[#2e2825] flex items-center justify-center">
        <span className="text-[var(--color-text-muted)] text-base">{player.initial}</span>
        <Image
          src={`/images/players/${player.id}.png`}
          alt={player.character}
          fill
          className="object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <span className="text-[0.6rem] text-[var(--color-text-muted)] uppercase tracking-wider">
        {player.character}
      </span>
    </Link>
  );
}

// Renders all player circles in a row
export default function PlayerCircles({ players }: { players: Player[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-4 pl-1">
      {players.map(p => <PlayerCircle key={p.id} player={p} />)}
    </div>
  );
}
