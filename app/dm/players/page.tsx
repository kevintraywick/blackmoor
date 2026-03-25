export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { PlayerSheet } from '@/lib/types';
import { PLAYERS } from '@/lib/players';
import DmNav from '@/components/DmNav';
import DmPlayersClient from '@/components/DmPlayersClient';

async function getSheets(): Promise<Record<string, PlayerSheet>> {
  await ensureSchema();
  const rows = await query<PlayerSheet>('SELECT * FROM player_sheets');

  const empty: Omit<PlayerSheet, 'id'> = {
    discord: '', species: '', class: '', level: '', hp: '', xp: '',
    speed: '', size: '', ac: '', boons: '', class_features: '',
    species_traits: '', player_notes: '', general_notes: '', gear: [], spells: [],
    dm_notes: '', status: 'active',
  };

  return Object.fromEntries(
    PLAYERS.map(p => {
      const row = rows.find(r => r.id === p.id);
      return [p.id, row
        ? { ...row, gear: row.gear ?? [], spells: row.spells ?? [], dm_notes: row.dm_notes ?? '', status: row.status ?? 'active' }
        : { id: p.id, ...empty }
      ];
    })
  );
}

export default async function DmPlayersPage() {
  const sheets = await getSheets();

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0] font-serif">
      <DmNav current="players" />
      <DmPlayersClient sheets={sheets} />
    </div>
  );
}
