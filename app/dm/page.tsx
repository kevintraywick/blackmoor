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
    <div className="min-h-screen bg-[#1a1614] text-[#f0e6d3]">

      {/* ── Nav ── */}
      <div className="sticky top-0 bg-[#1a1614]/95 backdrop-blur border-b border-[#3d3530] px-6 py-2.5 flex items-center gap-4 z-10 text-[0.8rem]">
        <Link href="/" className="font-cinzel text-[#e8a030] tracking-widest font-semibold hover:text-[#f5c060] transition-colors no-underline">
          BLACKMOOR
        </Link>
        <span className="text-[#3d3530]">·</span>
        <span className="text-white font-semibold tracking-wide">Sessions</span>
        <span className="text-[#3d3530]">·</span>
        <Link href="/players" className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Players</Link>
        <Link href="/dm/maps" className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Maps</Link>
        <Link href="/dm/magic" className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Magic</Link>
        <Link href="/dm/marketplace" className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Marketplace</Link>
        <Link href="/dm/poisons" className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Poisons & Traps</Link>
      </div>

      {/* ── Campaign hero ── */}
      <div className="px-10 pt-12 pb-8 border-b border-[#3d3530]" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(232,160,48,0.08) 0%, transparent 70%)'
      }}>
        <div className="max-w-[640px]">
          <div className="font-cinzel text-[3.5rem] font-black leading-none tracking-[0.06em] text-[#e8a030] mb-2"
            style={{ textShadow: '0 2px 24px rgba(232,160,48,0.3)' }}>
            BLACKMOOR
          </div>
          <div className="font-serif italic text-[1.25rem] text-[#f0e6d3]/70 tracking-wide mb-6">
            Shadow of the Wolf
          </div>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-[#e8a030]/40 to-transparent" />
            <span className="font-cinzel text-[0.6rem] tracking-[0.3em] text-[#e8a030]/60 uppercase">DM Command</span>
            <div className="h-px flex-1 bg-gradient-to-l from-[#e8a030]/40 to-transparent" />
          </div>
        </div>
      </div>

      {/* ── Sessions ── */}
      <div className="max-w-[640px] px-10 py-8">
        <div className="font-cinzel text-[0.65rem] tracking-[0.25em] text-[#e8a030]/70 uppercase mb-5">
          Sessions
        </div>
        <SessionList initial={sessions} />
      </div>
    </div>
  );
}
