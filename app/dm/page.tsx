export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session } from '@/lib/types';
import SessionList from '@/components/SessionList';

async function getSessions() {
  await ensureSchema();
  return query<Session>('SELECT * FROM sessions ORDER BY sort_order ASC, number ASC');
}

export default async function DMPage() {
  const sessions = await getSessions();

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">

      {/* Sticky nav */}
      <div className="sticky top-0 bg-[#231f1c] border-b border-[#3d3530] px-8 py-3 flex items-center gap-3 z-10 text-sm">
        <Link href="/" className="text-white hover:text-[#c9a84c] no-underline">← Home</Link>
        <span className="text-[#3d3530]">|</span>
        <span className="text-white font-bold">Sessions</span>
        <span className="text-[#3d3530]">|</span>
        <Link href="/players" className="text-white hover:text-[#c9a84c] no-underline">Players</Link>
        <Link href="/dm/maps" className="text-white hover:text-[#c9a84c] no-underline">Maps</Link>
        <Link href="/dm/magic" className="text-white hover:text-[#c9a84c] no-underline">Magic</Link>
        <Link href="/dm/marketplace" className="text-white hover:text-[#c9a84c] no-underline">Marketplace</Link>
        <Link href="/dm/poisons" className="text-white hover:text-[#c9a84c] no-underline">Poisons & Traps</Link>
      </div>

      <div className="max-w-[480px] mx-auto px-8 py-8">
        <div className="text-[#c9a84c] text-xs uppercase tracking-[0.18em] mb-6 pb-2 border-b border-[#3d3530]">Sessions</div>
        <SessionList initial={sessions} />
      </div>
    </div>
  );
}
