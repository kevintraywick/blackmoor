export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session } from '@/lib/types';
import SessionList from '@/components/SessionList';
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

      <div className="max-w-[480px] mx-auto px-8 py-10">
        {/* Campaign identity */}
        <div className="mb-8">
          <h1 className="font-serif text-[2.5rem] leading-none text-[#e8ddd0] italic tracking-tight">
            Blackmoor
          </h1>
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mt-1.5">
            Shadow of the Wolf · Session Log
          </p>
          <div className="mt-5 border-t border-[#3d3530]" />
        </div>
        <SessionList initial={sessions} />
      </div>
    </div>
  );
}
