export const dynamic = 'force-dynamic';

import Image from 'next/image';
import DmNav from '@/components/DmNav';
import InitiativePageClient from '@/components/InitiativePageClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session, Npc, PlayerSheet } from '@/lib/types';

type SessionMeta = Pick<Session, 'id' | 'number' | 'title' | 'npc_ids'>;

export default async function InitiativePage() {
  await ensureSchema();
  const [sessions, npcs, playerRows] = await Promise.all([
    query<SessionMeta>('SELECT id, number, title, npc_ids FROM sessions ORDER BY number ASC'),
    query<Npc>('SELECT * FROM npcs ORDER BY name ASC'),
    query<Pick<PlayerSheet, 'id' | 'status'>>('SELECT id, status FROM player_sheets'),
  ]);

  const playerStatuses: Record<string, string> = Object.fromEntries(
    playerRows.map(r => [r.id, r.status ?? 'active'])
  );

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
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

      <InitiativePageClient sessions={sessions} npcs={npcs} playerStatuses={playerStatuses} />
    </div>
  );
}
