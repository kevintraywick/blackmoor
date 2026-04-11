export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import NpcPageClient from '@/components/NpcPageClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Npc, MenagerieEntry } from '@/lib/types';

export default async function NpcsPage() {
  await ensureSchema();
  const [npcs, sessions] = await Promise.all([
    query<Npc>('SELECT * FROM npcs ORDER BY created_at ASC'),
    query<{ id: string; number: number; title: string; started_at: number | null; ended_at: number | null; menagerie: MenagerieEntry[] }>(
      'SELECT id, number, title, started_at, ended_at, menagerie FROM sessions ORDER BY number ASC'
    ),
  ]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">
      <DmNav current="npcs" />
      <NpcPageClient initial={npcs} sessions={sessions} />
    </div>
  );
}
