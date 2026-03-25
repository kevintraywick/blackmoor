export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Image from 'next/image';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { PlayerSheet } from '@/lib/types';
import { PLAYERS } from '@/lib/players';
import DmNav from '@/components/DmNav';

export default async function DmPlayersPage() {
  await ensureSchema();
  const rows = await query<Pick<PlayerSheet, 'id' | 'status'>>('SELECT id, status FROM player_sheets');
  const statusMap = Object.fromEntries(rows.map(r => [r.id, r.status ?? 'active']));

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0] font-serif">
      <DmNav current="players" />

      <div className="max-w-[780px] mx-auto px-8 py-10">
        <h1 className="text-2xl font-serif text-[#e8ddd0] mb-8">Players</h1>

        <div className="flex flex-wrap gap-4">
          {PLAYERS.map(p => {
            const status = statusMap[p.id] ?? 'active';
            const isAway = status === 'away';
            const isRemoved = status === 'removed';
            return (
              <Link
                key={p.id}
                href={`/dm/players/${p.id}`}
                className={`flex flex-col items-center gap-2 p-4 rounded border transition-colors no-underline ${
                  isRemoved
                    ? 'border-[#3a1a1a] bg-[#1a1614] opacity-40 hover:opacity-60'
                    : isAway
                    ? 'border-[#3d3530] bg-[#1a1614] opacity-50 hover:opacity-70 hover:border-[#5a4a44]'
                    : 'border-[#3d3530] bg-[#1e1b18] hover:border-[#c9a84c]'
                }`}
              >
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[#2e2825] border-2 border-[#3d3530]">
                  <span className="absolute inset-0 flex items-center justify-center text-xl text-[#8a7d6e]">{p.initial}</span>
                  <Image src={p.img} alt={p.playerName} fill className="object-cover" />
                </div>
                <span className="text-[0.72rem] uppercase tracking-[0.1em] text-[#8a7d6e]">{p.playerName}</span>
                {isAway && <span className="text-[0.6rem] text-[#c9a84c]">Away</span>}
                {isRemoved && <span className="text-[0.6rem] text-[#c05050]">Removed</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
