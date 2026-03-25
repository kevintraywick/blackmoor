export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { PlayerSheet as PlayerSheetType } from '@/lib/types';
import { PLAYERS } from '@/lib/players';
import { Sheet } from '@/components/PlayerSheet';
import PlayerMapPanel from '@/components/PlayerMapPanel';
import PlayerBanner from '@/components/PlayerBanner';
import DmNav from '@/components/DmNav';
import DmPlayerBox from '@/components/DmPlayerBox';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DmPlayerPage({ params }: Props) {
  const { id } = await params;

  const player = PLAYERS.find(p => p.id === id);
  if (!player) notFound();

  await ensureSchema();
  const rows = await query<PlayerSheetType>('SELECT * FROM player_sheets WHERE id = $1', [id]);

  const empty: PlayerSheetType = {
    id, discord: '', species: '', class: '', level: '', hp: '', xp: '',
    speed: '', size: '', ac: '', boons: '', class_features: '',
    species_traits: '', player_notes: '', general_notes: '', gear: [], spells: [],
    dm_notes: '', status: 'active',
  };

  const data: PlayerSheetType = rows[0]
    ? { ...rows[0], gear: rows[0].gear ?? [], spells: rows[0].spells ?? [], dm_notes: rows[0].dm_notes ?? '', status: rows[0].status ?? 'active' }
    : empty;

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0] font-serif">
      <DmNav current="players" />

      <PlayerBanner playerId={player.id} />

      <div className="relative z-10 -mt-[169px] max-w-[780px] mx-auto px-4 pt-6 pb-16 bg-[#1a1614] rounded-t-2xl">
        <DmPlayerBox
          playerId={player.id}
          initialNotes={data.dm_notes}
          initialStatus={data.status as 'active' | 'away' | 'removed'}
        />
        <Sheet
          playerId={player.id}
          playerName={player.playerName}
          character={player.character}
          initial={player.initial}
          data={data}
        />
        <PlayerMapPanel playerId={player.id} />
      </div>
    </div>
  );
}
