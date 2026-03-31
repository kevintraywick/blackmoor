export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import type { PoisonStatus } from '@/lib/types';
import DmNav from '@/components/DmNav';
import PoisonClient from '@/components/PoisonClient';

export default async function PoisonsPage() {
  await ensureSchema();
  const [players, poisons] = await Promise.all([
    getPlayers(),
    query<PoisonStatus>('SELECT * FROM poison_status WHERE active = true ORDER BY started_at DESC'),
  ]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="poisons" poisonCount={poisons.length} />
      <PoisonClient players={players} initialPoisons={poisons} />
    </div>
  );
}
