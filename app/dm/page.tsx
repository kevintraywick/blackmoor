export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session, Npc } from '@/lib/types';
import { getPlayers } from '@/lib/getPlayers';
import DmSessionsClient from '@/components/DmSessionsClient';
import DmNav from '@/components/DmNav';

export default async function DMPage() {
  await ensureSchema();
  const [sessions, npcs, players] = await Promise.all([
    query<Session>('SELECT * FROM sessions ORDER BY sort_order ASC, number ASC'),
    query<Npc>('SELECT id, name, image_path FROM npcs ORDER BY name ASC'),
    getPlayers(),
  ]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="sessions" />
      <DmSessionsClient initial={sessions} allNpcs={npcs} players={players} />
    </div>
  );
}
