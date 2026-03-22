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
      <nav className="sticky top-0 bg-[#1a1614]/95 backdrop-blur border-b border-[#3d3530] px-8 py-2.5 flex items-center gap-2 z-10 text-sm">
        <Link href="/" className="text-[#8a7d6e] hover:text-[#e8ddd0] transition-colors no-underline">← Home</Link>
        <span className="text-[#3d3530] select-none">·</span>
        <Link href="/dm" className="text-[#e8ddd0] hover:text-[#c9a84c] transition-colors no-underline">Sessions</Link>
        <span className="text-[#3d3530] select-none">·</span>
        <span className="text-[#c9a84c] font-semibold">{label}</span>
        <span className="text-[#3d3530] select-none">·</span>
        <Link href="/players" className="text-[#e8ddd0] hover:text-[#c9a84c] transition-colors no-underline">Players</Link>
        <span className="text-[#3d3530] select-none">·</span>
        <Link href={`/dm/maps?session=${id}`} className="text-[#e8ddd0] hover:text-[#c9a84c] transition-colors no-underline">Maps</Link>
        <span className="text-[#3d3530] select-none">·</span>
        <Link href="/dm/magic" className="text-[#e8ddd0] hover:text-[#c9a84c] transition-colors no-underline">Magic</Link>
        <span className="text-[#3d3530] select-none">·</span>
        <Link href="/dm/marketplace" className="text-[#e8ddd0] hover:text-[#c9a84c] transition-colors no-underline">Marketplace</Link>
        <span className="text-[#3d3530] select-none">·</span>
        <Link href="/dm/poisons" className="text-[#e8ddd0] hover:text-[#c9a84c] transition-colors no-underline">Poisons & Traps</Link>
      </nav>

      {/* The editable form — handles all state and autosave client-side */}
      <SessionForm session={session} />
    </div>
  );
}
