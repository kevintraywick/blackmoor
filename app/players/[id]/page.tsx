export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getPlayerById } from '@/lib/getPlayers';
import type { PlayerSheet as PlayerSheetType } from '@/lib/types';
import { Sheet } from '@/components/PlayerSheet';
import PlayerBanner from '@/components/PlayerBanner';
import WolfHowl from '@/components/WolfHowl';
import NewsieCallout from '@/components/NewsieCallout';
import OverheardWatcher from '@/components/OverheardWatcher';
import RavenNavPulse from '@/components/RavenNavPulse';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;

  await ensureSchema();
  const player = await getPlayerById(id);
  if (!player) notFound();

  const unreadByMedium = (medium: string) => query<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM raven_items ri
     WHERE ri.medium = $1 AND ri.target_player = $2
       AND NOT EXISTS (SELECT 1 FROM raven_reads rr WHERE rr.item_id = ri.id AND rr.player_id = $2)`,
    [medium, id],
  );

  const [rows, unreadRows, poisonRows, boonRows, sendingRows, druidRows, cantRows] = await Promise.all([
    query<PlayerSheetType>('SELECT * FROM player_sheets WHERE id = $1', [id]),
    query<{ count: number }>('SELECT COUNT(*)::int as count FROM dm_messages WHERE player_id = $1 AND read = false', [id]),
    query<{ count: number }>('SELECT COUNT(*)::int as count FROM poison_status WHERE player_id = $1 AND active = true', [id]),
    query<{ count: number; unseen: number }>('SELECT COUNT(*)::int as count, COUNT(*) FILTER (WHERE seen = false)::int as unseen FROM player_boons WHERE player_id = $1 AND active = true', [id]),
    unreadByMedium('sending'),
    unreadByMedium('druid_sign'),
    unreadByMedium('cant'),
  ]);
  const unreadCount = unreadRows[0]?.count ?? 0;
  const poisonCount = poisonRows[0]?.count ?? 0;
  const boonCount = boonRows[0]?.count ?? 0;
  const boonUnseen = boonRows[0]?.unseen ?? 0;
  const sendingCount = sendingRows[0]?.count ?? 0;
  const druidSignCount = druidRows[0]?.count ?? 0;
  const cantCount = cantRows[0]?.count ?? 0;

  const empty: PlayerSheetType = {
    id, discord: '', sms_phone: '', sms_optin: false, species: '', class: '', level: '', hp: '', xp: '',
    speed: '', size: '', ac: '', gold: '', boons: '', class_features: '',
    species_traits: '', player_notes: '', general_notes: '', gear: [], spells: [], items: [],
    str: '', dex: '', con: '', int: '', wis: '', cha: '',
    align: '', current_hp: '', max_hp: '', dm_notes: '', status: 'active',
  };

  const data = rows[0] ? { ...rows[0], gear: rows[0].gear ?? [], spells: rows[0].spells ?? [] } : empty;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">

      <div className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 sm:px-8 py-2 sm:py-3 z-10 text-sm" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px' }}>
        <Link href="/" title="Shadow of the Wolf" className="flex-shrink-0"><div className="relative rounded-full overflow-hidden" style={{ width: 30, height: 30 }}><Image src="/images/invite/dice_home.png" alt="Home" fill className="object-cover" /></div></Link>
        <span className="text-[var(--color-border)] hidden sm:inline">|</span>
        <span className="text-[var(--color-gold)] font-bold" style={{ margin: '0 4px' }}>{player.playerName}</span>
        <span className="text-[var(--color-border)] hidden sm:inline">|</span>
        <Link href="/canyouplay" className="text-[var(--color-text)] hover:text-[var(--color-gold)] no-underline">Upcoming Games</Link>
        <span className="text-[var(--color-border)]">·</span>
        <Link href={`/dm/marketplace?player=${player.id}`} className="text-[var(--color-text)] hover:text-[var(--color-gold)] no-underline">Marketplace</Link>
        <span className="text-[var(--color-border)]">·</span>
        <Link
          href={`/raven-post?playerId=${player.id}`}
          id="raven-post-nav-link"
          className="text-[var(--color-text)] hover:text-[var(--color-gold)] no-underline"
        >
          Raven Post
        </Link>
        <span className="text-[var(--color-border)]">·</span>
        <Link href="/journey" className="text-[var(--color-text)] hover:text-[var(--color-gold)] no-underline italic">Our story so far…</Link>
      </div>

      <WolfHowl playerId={player.id} />
      <PlayerBanner playerId={player.id} />
      <RavenNavPulse />
      <NewsieCallout playerId={player.id} />
      <OverheardWatcher playerId={player.id} smsOptin={data.sms_optin === true} />

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
          boonCount={boonCount}
          boonUnseen={boonUnseen}
          sendingCount={sendingCount}
          druidSignCount={druidSignCount}
          cantCount={cantCount}
        />
      </div>
    </div>
  );
}
