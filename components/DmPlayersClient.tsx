'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { PlayerSheet } from '@/lib/types';
import { PLAYERS } from '@/lib/players';
import { Sheet } from '@/components/PlayerSheet';
import DmPlayerBox from '@/components/DmPlayerBox';

export default function DmPlayersClient({
  sheets,
}: {
  sheets: Record<string, PlayerSheet>;
}) {
  const firstActive = PLAYERS.find(p => (sheets[p.id]?.status ?? 'active') !== 'removed')?.id ?? PLAYERS[0].id;
  const [selectedId, setSelectedId] = useState(firstActive);

  const selectedPlayer = PLAYERS.find(p => p.id === selectedId)!;
  const selectedSheet  = sheets[selectedId];

  return (
    <div className="max-w-[780px] mx-auto px-4 pb-16">

      {/* Player selector — same layout as /players, but DM sees all (incl. removed) */}
      <div className="flex justify-center gap-4 flex-wrap py-5 bg-[#231f1c] border-b border-[#3d3530] -mx-4 px-4 mb-4">
        {PLAYERS.map(p => {
          const status    = sheets[p.id]?.status ?? 'active';
          const isAway    = status === 'away';
          const isRemoved = status === 'removed';
          const isActive  = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-none transition-opacity ${
                isRemoved ? 'opacity-30' : isAway ? 'opacity-50' : ''
              }`}
            >
              <div className={`relative w-20 h-20 rounded-full overflow-hidden border-[3px] transition-all ${
                isActive
                  ? 'border-[#c9a84c]'
                  : 'border-[#3d3530] hover:border-[#8a7d6e] hover:scale-105'
              } bg-[#2e2825] flex items-center justify-center`}>
                <span className="text-[1.6rem] text-[#8a7d6e] select-none">{p.initial}</span>
                <Image
                  src={p.img}
                  alt={p.playerName}
                  fill
                  className="object-cover absolute inset-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <span className={`text-[0.72rem] uppercase tracking-[0.1em] transition-colors ${
                isActive ? 'text-[#c9a84c]' : 'text-[#8a7d6e]'
              }`}>
                {p.playerName}
                {isAway    ? ' · away'    : ''}
                {isRemoved ? ' · removed' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* DM box — updates per selected player */}
      <DmPlayerBox
        key={selectedId}
        playerId={selectedId}
        initialNotes={selectedSheet?.dm_notes ?? ''}
        initialStatus={(selectedSheet?.status ?? 'active') as 'active' | 'away' | 'removed'}
      />

      {/* Player sheet — mirror of the player's own page */}
      <Sheet
        key={`sheet-${selectedId}`}
        playerId={selectedPlayer.id}
        playerName={selectedPlayer.playerName}
        character={selectedPlayer.character}
        initial={selectedPlayer.initial}
        data={selectedSheet}
      />
    </div>
  );
}
