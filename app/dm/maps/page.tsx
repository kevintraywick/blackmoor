export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapRow } from '@/lib/types';
import DmMapsClient from './DmMapsClient';

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
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <div className="sticky top-0 bg-[#231f1c] border-b border-[#3d3530] px-8 py-3 flex items-center gap-3 z-10 text-sm">
        <Link href="/dm" className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">← Sessions</Link>
        <span className="text-[#3d3530]">|</span>
        <span className="text-[#c9a84c] font-bold">{sessionTitle || 'Maps'}</span>
        <span className="text-[#3d3530]">|</span>
        <span className="text-[#e8ddd0]">Maps</span>
      </div>

      <div className="px-6 py-6">
        <Suspense fallback={null}>
          <DmMapsClient initialMaps={maps} sessionId={sessionId ?? ''} />
        </Suspense>
      </div>
    </div>
  );
}
