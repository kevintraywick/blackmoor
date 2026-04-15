export const dynamic = 'force-dynamic';

import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import { query } from '@/lib/db';
import type { Availability } from '@/lib/types';
import CanYouPlayClient from '@/components/CanYouPlayClient';

export default async function CanYouPlayPage() {
  await ensureSchema();

  const [players, availabilityRows, campaignRows] = await Promise.all([
    getPlayers({ publicOnly: true }),
    query<Availability>('SELECT player_id, saturday, status FROM availability'),
    query<{ quorum: number }>('SELECT quorum FROM campaign LIMIT 1'),
  ]);

  const quorum = campaignRows[0]?.quorum ?? 4;

  return (
    <CanYouPlayClient
      players={players}
      initialAvailability={availabilityRows}
      quorum={quorum}
    />
  );
}
