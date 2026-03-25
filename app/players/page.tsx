// Always render at request time — player data can change between visits
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { PlayerSheet } from '@/lib/types';
import { PLAYERS } from '@/lib/players';
import PlayerSheets from '@/components/PlayerSheet';

// Fetch all player sheet rows, return a keyed object { levi: {...}, jeanette: {...}, ... }
async function getSheets(): Promise<Record<string, PlayerSheet>> {
  await ensureSchema();
  const rows = await query<PlayerSheet>('SELECT * FROM player_sheets');

  // Build an id-keyed map, filling in empty defaults for any player with no row yet
  const empty: Omit<PlayerSheet, 'id'> = {
    discord: '', species: '', class: '', level: '', hp: '', xp: '',
    speed: '', size: '', ac: '', boons: '', class_features: '',
    species_traits: '', player_notes: '', general_notes: '', gear: [], spells: [],
    dm_notes: '', status: 'active',
  };

  return Object.fromEntries(
    PLAYERS.map(p => {
      const row = rows.find(r => r.id === p.id);
      return [p.id, row ? { ...row, gear: row.gear ?? [], spells: row.spells ?? [] } : { id: p.id, ...empty }];
    })
  );
}

export default async function PlayersPage() {
  const sheets = await getSheets();

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
      <PlayerSheets sheets={sheets} />
    </div>
  );
}
