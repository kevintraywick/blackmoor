'use client'; // needs onClick (browser-only)

import Link from 'next/link';
import Image from 'next/image';

interface Player {
  id: string;
  character: string; // character name shown under the circle
  initial: string;   // fallback letter if no portrait
}

// The six campaign players — update here when roster changes
export const PLAYERS: Player[] = [
  { id: 'levi',     character: 'Garrick',  initial: 'L' },
  { id: 'jeanette', character: 'Eleil',    initial: 'J' },
  { id: 'nicole',   character: 'HollyGo',  initial: 'N' },
  { id: 'katie',    character: 'Lysandra', initial: 'K' },
  { id: 'brandon',  character: 'Vaoker',   initial: 'B' },
  { id: 'ashton',   character: 'Ash',      initial: 'A' },
];

function PlayerCircle({ player }: { player: Player }) {
  // Store selected player in sessionStorage so Marketplace can auto-select them
  const handleClick = () => {
    try { sessionStorage.setItem('dd-active-player', player.id); } catch {}
  };

  return (
    <Link
      href={`/players?id=${player.id}`}
      onClick={handleClick}
      className="flex flex-col items-center gap-1 no-underline"
    >
      {/* Portrait circle with fallback initial */}
      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#3d3530] bg-[#2e2825] flex items-center justify-center">
        <span className="text-[#8a7d6e] text-base">{player.initial}</span>
        <Image
          src={`/images/players/${player.id}.png`}
          alt={player.character}
          fill
          className="object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <span className="text-[0.6rem] text-[#8a7d6e] uppercase tracking-wider">
        {player.character}
      </span>
    </Link>
  );
}

// Renders all player circles in a row
export default function PlayerCircles() {
  return (
    <div className="flex flex-wrap gap-2 mt-4 pl-1">
      {PLAYERS.map(p => <PlayerCircle key={p.id} player={p} />)}
    </div>
  );
}
