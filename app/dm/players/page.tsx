export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import type { PlayerSheet } from '@/lib/types';
import DmNav from '@/components/DmNav';
import DmPlayersClient from '@/components/DmPlayersClient';

async function getSheets(playerIds: string[]): Promise<Record<string, PlayerSheet>> {
  const rows = await query<PlayerSheet>('SELECT * FROM player_sheets');

  const empty: Omit<PlayerSheet, 'id'> = {
    discord: '', species: '', class: '', level: '', hp: '', xp: '',
    speed: '', size: '', ac: '', gold: '', boons: '', class_features: '',
    species_traits: '', player_notes: '', general_notes: '', gear: [], spells: [], items: [],
    str: '', dex: '', con: '', int: '', wis: '', cha: '',
    dm_notes: '', status: 'active',
  };

  return Object.fromEntries(
    playerIds.map(id => {
      const row = rows.find(r => r.id === id);
      return [id, row
        ? { ...row, gear: row.gear ?? [], spells: row.spells ?? [], dm_notes: row.dm_notes ?? '', status: row.status ?? 'active' }
        : { id, ...empty }
      ];
    })
  );
}

export default async function DmPlayersPage() {
  await ensureSchema();
  const players = await getPlayers();
  const sheets = await getSheets(players.map(p => p.id));

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">
      <DmNav current="players" />
      <DmPlayersClient players={players} sheets={sheets} />
    </div>
  );
}
