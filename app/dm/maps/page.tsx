export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapRow } from '@/lib/types';
import DmMapsClient from './DmMapsClient';
import DmNav from '@/components/DmNav';

interface Props {
  searchParams: Promise<{ session?: string }>;
}

export default async function DmMapsPage({ searchParams }: Props) {
  const { session: sessionId } = await searchParams;

  await ensureSchema();

  let maps: MapRow[] = [];
  let sessionTitle = '';

  if (sessionId) {
    maps = await query<MapRow>(
      'SELECT * FROM maps WHERE session_id = $1 ORDER BY sort_order ASC, created_at ASC',
      [sessionId]
    );
    const [session] = await query<{ title: string; number: number }>(
      'SELECT title, number FROM sessions WHERE id = $1',
      [sessionId]
    );
    sessionTitle = session ? `Session ${session.number}${session.title ? ` — ${session.title}` : ''}` : '';
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="maps" sessionId={sessionId} />

      <div className="px-6 py-6">
        <Suspense fallback={null}>
          <DmMapsClient initialMaps={maps} sessionId={sessionId ?? ''} />
        </Suspense>
      </div>
    </div>
  );
}
