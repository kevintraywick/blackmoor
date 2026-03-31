export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import type { PlayerSheet as PlayerSheetType } from '@/lib/types';
import { Sheet } from '@/components/PlayerSheet';
import PlayerMapPanel from '@/components/PlayerMapPanel';
import PlayerBanner from '@/components/PlayerBanner';
import WolfHowl from '@/components/WolfHowl';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;

  await ensureSchema();
  const players = await getPlayers();
  const player = players.find(p => p.id === id);
  if (!player) notFound();

  const [rows, unreadRows, poisonRows] = await Promise.all([
    query<PlayerSheetType>('SELECT * FROM player_sheets WHERE id = $1', [id]),
    query<{ count: number }>('SELECT COUNT(*)::int as count FROM dm_messages WHERE player_id = $1 AND read = false', [id]),
    query<{ count: number }>('SELECT COUNT(*)::int as count FROM poison_status WHERE player_id = $1 AND active = true', [id]),
  ]);
  const unreadCount = unreadRows[0]?.count ?? 0;
  const poisonCount = poisonRows[0]?.count ?? 0;

  const empty: PlayerSheetType = {
    id, discord: '', species: '', class: '', level: '', hp: '', xp: '',
    speed: '', size: '', ac: '', gold: '', boons: '', class_features: '',
    species_traits: '', player_notes: '', general_notes: '', gear: [], spells: [], items: [],
    dm_notes: '', status: 'active',
  };

  const data = rows[0] ? { ...rows[0], gear: rows[0].gear ?? [], spells: rows[0].spells ?? [] } : empty;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">

      <div className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-8 py-3 flex items-center gap-3 z-10 text-sm">
        <Link href="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] no-underline flex items-center gap-1"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 -mt-px"><path d="M10 3L5 8l5 5" /></svg>Home</Link>
        <span className="text-[var(--color-border)]">|</span>
        <span className="text-[var(--color-gold)] font-bold">{player.playerName}</span>
        <span className="text-[var(--color-border)]">/</span>
        <span className="text-[var(--color-text)]">{player.character}</span>
        <span className="text-[var(--color-border)]">|</span>
        <Link href="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] no-underline">All Players</Link>
        <span className="text-[var(--color-border)]">|</span>
        <Link href={`/dm/marketplace?player=${player.id}`} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] no-underline">Marketplace</Link>
      </div>

      <WolfHowl playerId={player.id} />
      <PlayerBanner playerId={player.id} />

      <div className="relative z-10 -mt-[169px] max-w-[860px] mx-auto px-4 pt-6 pb-16 bg-[var(--color-bg)] rounded-t-2xl">
        <Sheet
          playerId={player.id}
          playerName={player.playerName}
          character={player.character}
          initial={player.initial}
          img={player.img}
          data={data}
          unreadCount={unreadCount}
          poisonCount={poisonCount}
        />
        <PlayerMapPanel playerId={player.id} />
      </div>
    </div>
  );
}
