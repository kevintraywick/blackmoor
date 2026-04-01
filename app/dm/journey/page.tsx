export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session } from '@/lib/types';
import DmNav from '@/components/DmNav';
import JourneyClient from '@/components/JourneyClient';

export default async function JourneyPage() {
  await ensureSchema();
  const sessions = await query<Session>('SELECT * FROM sessions ORDER BY number ASC');

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="journey" />
      <JourneyClient sessions={sessions} />
    </div>
  );
}
