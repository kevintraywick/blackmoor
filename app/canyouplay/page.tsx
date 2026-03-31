export const dynamic = 'force-dynamic';

import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import { query } from '@/lib/db';
import type { Availability } from '@/lib/types';
import CanYouPlayClient from '@/components/CanYouPlayClient';

export default async function CanYouPlayPage() {
  await ensureSchema();

  const [players, availabilityRows, campaignRows, sessionRows] = await Promise.all([
    getPlayers(),
    query<Availability>('SELECT player_id, saturday, status FROM availability'),
    query<{ quorum: number }>('SELECT quorum FROM campaign LIMIT 1'),
    query<{ date: string }>('SELECT date FROM sessions WHERE date != \'\''),
  ]);

  const quorum = campaignRows[0]?.quorum ?? 4;
  const sessionDates = new Set(sessionRows.map(r => r.date));

  return (
    <CanYouPlayClient
      players={players}
      initialAvailability={availabilityRows}
      quorum={quorum}
      sessionDates={Array.from(sessionDates)}
    />
  );
}
