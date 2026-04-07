// Always render at request time — player data can change between visits
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Image from 'next/image';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import type { PlayerSheet } from '@/lib/types';
import PlayerSheets from '@/components/PlayerSheet';

async function getSheets(playerIds: string[]): Promise<Record<string, PlayerSheet>> {
  const rows = await query<PlayerSheet>('SELECT * FROM player_sheets');

  const empty: Omit<PlayerSheet, 'id'> = {
    discord: '', species: '', class: '', level: '', hp: '', xp: '',
    speed: '', size: '', ac: '', gold: '', boons: '', class_features: '',
    species_traits: '', player_notes: '', general_notes: '', gear: [], spells: [], items: [],
    str: '', dex: '', con: '', int: '', wis: '', cha: '',
    align: '', dm_notes: '', status: 'active',
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
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">

      {/* Sticky nav */}
      <nav className="sticky top-0 bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)] px-8 py-2.5 flex items-center gap-4 z-10 text-sm">
        <Link href="/" title="Shadow of the Wolf" className="flex-shrink-0">
          <div className="relative rounded-full overflow-hidden" style={{ width: 30, height: 30 }}><Image src="/images/invite/dice_home.png" alt="Home" fill className="object-cover" /></div>
        </Link>
        <span className="text-[var(--color-gold)] font-semibold">Players</span>
      </nav>

      {/* Client component handles selector + active sheet */}
      <PlayerSheets players={players} sheets={sheets} />
    </div>
  );
}
