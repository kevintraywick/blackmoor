// Server component — fetches this session from DB, passes it to the client form
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { query } from '@/lib/db';
import type { Session } from '@/lib/types';
import SessionForm from '@/components/SessionForm';

// Always render fresh — session data changes frequently
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: Props) {
  const { id } = await params;

  // Fetch this specific session by ID
  const rows = await query<Session>('SELECT * FROM sessions WHERE id = $1', [id]);
  const session = rows[0];

  // Show 404 if session doesn't exist
  if (!session) notFound();

  const label = session.title ? `#${session.number} ${session.title}` : `Session #${session.number}`;

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0] font-serif">

      {/* Sticky top bar with breadcrumb nav and save status (save status is in SessionForm) */}
      <div className="sticky top-0 bg-[#1a1614]/95 backdrop-blur border-b border-[#3d3530] px-6 py-2.5 flex items-center gap-4 z-10 text-[0.8rem]">
        <Link href="/dm" className="font-cinzel text-[#e8a030] tracking-widest font-semibold hover:text-[#f5c060] transition-colors no-underline">
          BLACKMOOR
        </Link>
        <span className="text-[#3d3530]">·</span>
        <Link href="/dm" className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Sessions</Link>
        <span className="text-[#3d3530]">·</span>
        <span className="text-[#e8a030] font-semibold">{label}</span>
        <span className="text-[#3d3530] ml-auto">·</span>
        <Link href="/players" className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Players</Link>
        <Link href={`/dm/maps?session=${id}`} className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Maps</Link>
        <Link href="/dm/magic" className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Magic</Link>
        <Link href="/dm/marketplace" className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Marketplace</Link>
        <Link href="/dm/poisons" className="text-white/70 hover:text-[#e8a030] transition-colors no-underline">Poisons & Traps</Link>
      </div>

      {/* The editable form — handles all state and autosave client-side */}
      <SessionForm session={session} />
    </div>
  );
}
