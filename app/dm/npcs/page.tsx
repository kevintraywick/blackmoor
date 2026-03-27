export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import NpcPageClient from '@/components/NpcPageClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Npc } from '@/lib/types';

export default async function NpcsPage() {
  await ensureSchema();
  const npcs = await query<Npc>('SELECT * FROM npcs ORDER BY created_at ASC');

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">
      <DmNav current="npcs" />
      <NpcPageClient initial={npcs} />
    </div>
  );
}
