export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { PlayerSheet as PlayerSheetType } from '@/lib/types';
import { PLAYERS, Sheet } from '@/components/PlayerSheet';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;

  const player = PLAYERS.find(p => p.id === id);
  if (!player) notFound();

  await ensureSchema();
  const rows = await query<PlayerSheetType>('SELECT * FROM player_sheets WHERE id = $1', [id]);

  const empty: PlayerSheetType = {
    id, discord: '', species: '', class: '', level: '', hp: '', xp: '',
    speed: '', size: '', ac: '', boons: '', class_features: '',
    species_traits: '', player_notes: '', general_notes: '', gear: [],
  };

  const data = rows[0] ? { ...rows[0], gear: rows[0].gear ?? [] } : empty;

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0] font-serif">

      <div className="sticky top-0 bg-[#231f1c] border-b border-[#3d3530] px-8 py-3 flex items-center gap-3 z-10 text-sm">
        <Link href="/" className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">← Home</Link>
        <span className="text-[#3d3530]">|</span>
        <span className="text-[#c9a84c] font-bold">{player.playerName}</span>
        <span className="text-[#3d3530]">/</span>
        <span className="text-[#e8ddd0]">{player.character}</span>
        <span className="text-[#3d3530]">|</span>
        <Link href="/players" className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">All Players</Link>
      </div>

      <div className="max-w-[780px] mx-auto px-4 py-6 pb-16">
        <Sheet
          playerId={player.id}
          playerName={player.playerName}
          character={player.character}
          initial={player.initial}
          data={data}
        />
      </div>
    </div>
  );
}
