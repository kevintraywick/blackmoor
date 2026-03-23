export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session } from '@/lib/types';
import DmSessionsClient from '@/components/DmSessionsClient';
import DmNav from '@/components/DmNav';

async function getSessions() {
  await ensureSchema();
  return query<Session>('SELECT * FROM sessions ORDER BY sort_order ASC, number ASC');
}

export default async function DMPage() {
  const sessions = await getSessions();

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <DmNav current="sessions" />
      <DmSessionsClient initial={sessions} />
    </div>
  );
}
