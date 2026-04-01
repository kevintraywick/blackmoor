export const dynamic = 'force-dynamic';

import Image from 'next/image';
import DmNav from '@/components/DmNav';
import InitiativePageClient from '@/components/InitiativePageClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import type { Session, Npc, PlayerSheet } from '@/lib/types';

type SessionMeta = Pick<Session, 'id' | 'number' | 'title' | 'npc_ids' | 'menagerie'>;

export default async function InitiativePage() {
  await ensureSchema();
  const [sessions, npcs, playerRows, players] = await Promise.all([
    query<SessionMeta>('SELECT id, number, title, npc_ids, menagerie FROM sessions ORDER BY number ASC'),
    query<Npc>('SELECT * FROM npcs ORDER BY name ASC'),
    query<Pick<PlayerSheet, 'id' | 'status' | 'hp'>>('SELECT id, status, hp FROM player_sheets'),
    getPlayers(),
  ]);

  const playerStatuses: Record<string, string> = Object.fromEntries(
    playerRows.map(r => [r.id, r.status ?? 'active'])
  );
  const playerHp: Record<string, number> = Object.fromEntries(
    playerRows.map(r => [r.id, parseInt(r.hp, 10) || 0])
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="initiative" />

      {/* Banner */}
      <div className="relative w-full h-48 sm:h-64">
        <Image
          src="/images/initiative_banner.png"
          alt="Initiative"
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      <InitiativePageClient sessions={sessions} npcs={npcs} playerStatuses={playerStatuses} playerHp={playerHp} players={players} />
    </div>
  );
}
