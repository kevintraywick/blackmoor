export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import NpcPageClient from '@/components/NpcPageClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Npc } from '@/lib/types';

async function getNpcs(): Promise<Npc[]> {
  await ensureSchema();
  return query<Npc>('SELECT * FROM npcs ORDER BY created_at ASC');
}

export default async function NpcsPage() {
  const npcs = await getNpcs();

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0] font-serif">
      <DmNav current="npcs" />
      <NpcPageClient initial={npcs} />
    </div>
  );
}
