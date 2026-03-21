// Always render at request time — player data can change between visits
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { PlayerSheet } from '@/lib/types';
import PlayerSheets, { PLAYERS } from '@/components/PlayerSheet';

// Fetch all player sheet rows, return a keyed object { levi: {...}, jeanette: {...}, ... }
async function getSheets(): Promise<Record<string, PlayerSheet>> {
  await ensureSchema();
  const rows = await query<PlayerSheet>('SELECT * FROM player_sheets');

  // Build an id-keyed map, filling in empty defaults for any player with no row yet
  const empty: Omit<PlayerSheet, 'id'> = {
    discord: '', species: '', class: '', level: '', hp: '', xp: '',
    speed: '', size: '', ac: '', boons: '', class_features: '',
    species_traits: '', player_notes: '', general_notes: '', gear: [],
  };

  return Object.fromEntries(
    PLAYERS.map(p => {
      const row = rows.find(r => r.id === p.id);
      return [p.id, row ? { ...row, gear: row.gear ?? [] } : { id: p.id, ...empty }];
    })
  );
}

export default async function PlayersPage() {
  const sheets = await getSheets();

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0] font-serif">

      {/* Sticky nav */}
      <div className="sticky top-0 bg-[#231f1c] border-b border-[#3d3530] px-8 py-3 flex items-center gap-3 z-10 text-sm">
        <Link href="/" className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">← Sessions</Link>
        <span className="text-[#3d3530]">|</span>
        <span className="text-[#e8ddd0]">Players</span>
        <span className="text-[#3d3530]">|</span>
        <Link href="/npcs"    className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">NPCs</Link>
        <Link href="/maps"    className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">Maps</Link>
        <Link href="/magic"   className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">Magic</Link>
      </div>

      {/* Client component handles selector + active sheet */}
      <PlayerSheets sheets={sheets} />
    </div>
  );
}
