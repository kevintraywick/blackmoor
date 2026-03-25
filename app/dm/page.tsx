export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session, Npc } from '@/lib/types';
import DmSessionsClient from '@/components/DmSessionsClient';
import DmNav from '@/components/DmNav';

export default async function DMPage() {
  await ensureSchema();
  const [sessions, npcs] = await Promise.all([
    query<Session>('SELECT * FROM sessions ORDER BY sort_order ASC, number ASC'),
    query<Npc>('SELECT id, name, image_path FROM npcs ORDER BY name ASC'),
  ]);

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <DmNav current="sessions" />
      <DmSessionsClient initial={sessions} allNpcs={npcs} />
    </div>
  );
}
