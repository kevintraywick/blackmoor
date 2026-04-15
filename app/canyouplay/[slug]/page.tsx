export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import { query } from '@/lib/db';
import type { Availability, Invitation } from '@/lib/types';
import CanYouPlayClient from '@/components/CanYouPlayClient';

export default async function InvitationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await ensureSchema();

  const [invitation] = await query<Invitation>(
    'SELECT * FROM invitations WHERE slug = $1',
    [slug]
  );

  if (!invitation) return notFound();

  const dates: string[] = Array.isArray(invitation.dates) ? invitation.dates : [];

  const [players, availabilityRows, campaignRows] = await Promise.all([
    getPlayers({ publicOnly: true }),
    query<Availability>(
      `SELECT player_id, saturday, status FROM availability WHERE saturday = ANY($1::text[])`,
      [dates]
    ),
    query<{ quorum: number }>('SELECT quorum FROM campaign LIMIT 1'),
  ]);

  const quorum = campaignRows[0]?.quorum ?? 4;

  return (
    <CanYouPlayClient
      players={players}
      initialAvailability={availabilityRows}
      quorum={quorum}
      dates={dates}
    />
  );
}
