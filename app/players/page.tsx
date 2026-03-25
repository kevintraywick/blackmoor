// Always render at request time — player data can change between visits
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import type { PlayerSheet } from '@/lib/types';
import PlayerSheets from '@/components/PlayerSheet';

async function getSheets(playerIds: string[]): Promise<Record<string, PlayerSheet>> {
  const rows = await query<PlayerSheet>('SELECT * FROM player_sheets');

  const empty: Omit<PlayerSheet, 'id'> = {
    discord: '', species: '', class: '', level: '', hp: '', xp: '',
    speed: '', size: '', ac: '', boons: '', class_features: '',
    species_traits: '', player_notes: '', general_notes: '', gear: [], spells: [],
    dm_notes: '', status: 'active',
  };

  return Object.fromEntries(
    playerIds.map(id => {
      const row = rows.find(r => r.id === id);
      return [id, row ? { ...row, gear: row.gear ?? [], spells: row.spells ?? [] } : { id, ...empty }];
    })
  );
}

export default async function PlayersPage() {
  await ensureSchema();
  const players = await getPlayers();
  const sheets = await getSheets(players.map(p => p.id));

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0] font-serif">

      {/* Sticky nav */}
      <nav className="sticky top-0 bg-[#1a1614]/95 backdrop-blur border-b border-[#3d3530] px-8 py-2.5 flex items-center gap-2 z-10 text-sm">
        <Link href="/" className="text-[#8a7d6e] hover:text-[#e8ddd0] transition-colors no-underline">← Home</Link>
        <span className="text-[#3d3530] select-none">·</span>
        <span className="text-[#c9a84c] font-semibold">Players</span>
        <span className="text-[#3d3530] select-none">·</span>
        <span title="Coming soon" className="text-[#4a3c35] cursor-not-allowed select-none">NPCs</span>
        <span className="text-[#3d3530] select-none">·</span>
        <span title="Coming soon" className="text-[#4a3c35] cursor-not-allowed select-none">Maps</span>
        <span className="text-[#3d3530] select-none">·</span>
        <span title="Coming soon" className="text-[#4a3c35] cursor-not-allowed select-none">Magic</span>
      </nav>

      {/* Client component handles selector + active sheet */}
      <PlayerSheets players={players} sheets={sheets} />
    </div>
  );
}
