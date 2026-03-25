export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import InitiativePageClient from '@/components/InitiativePageClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session, Npc } from '@/lib/types';

type SessionMeta = Pick<Session, 'id' | 'number' | 'title'>;

export default async function InitiativePage() {
  await ensureSchema();
  const sessions = await query<SessionMeta>(
    'SELECT id, number, title FROM sessions ORDER BY number ASC'
  );
  const npcs = await query<Npc>('SELECT * FROM npcs ORDER BY name ASC');

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <DmNav current="initiative" />
      <InitiativePageClient sessions={sessions} npcs={npcs} />
    </div>
  );
}
