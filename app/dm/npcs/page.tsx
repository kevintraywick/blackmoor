export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import NpcPageClient from '@/components/NpcPageClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Npc, Session } from '@/lib/types';

type SessionMeta = Pick<Session, 'id' | 'number' | 'title' | 'date' | 'npc_ids'>;

export default async function NpcsPage() {
  await ensureSchema();
  const [npcs, sessions] = await Promise.all([
    query<Npc>('SELECT * FROM npcs ORDER BY created_at ASC'),
    query<SessionMeta>('SELECT id, number, title, date, npc_ids FROM sessions ORDER BY number ASC'),
  ]);

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0] font-serif">
      <DmNav current="npcs" />
      <NpcPageClient initial={npcs} sessions={sessions} />
    </div>
  );
}
