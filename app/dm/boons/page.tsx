export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import type { BoonTemplate, PlayerBoon } from '@/lib/types';
import DmNav from '@/components/DmNav';
import BoonsDmClient from '@/components/BoonsDmClient';

export default async function BoonsPage() {
  await ensureSchema();
  const [players, templates, activeBoons] = await Promise.all([
    getPlayers(),
    query<BoonTemplate>('SELECT * FROM boon_templates ORDER BY category, name'),
    query<PlayerBoon>('SELECT * FROM player_boons WHERE active = true ORDER BY started_at DESC'),
  ]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="boons" />
      <BoonsDmClient players={players} initialTemplates={templates} initialActive={activeBoons} />
    </div>
  );
}
