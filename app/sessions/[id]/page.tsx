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
      <div className="sticky top-0 bg-[#231f1c] border-b border-[#3d3530] px-8 py-3 flex items-center gap-3 z-10 text-sm">
        <Link href="/" className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">← Sessions</Link>
        <span className="text-[#3d3530]">|</span>
        <span className="text-[#8a7d6e]">{label}</span>
        <span className="text-[#3d3530]">|</span>
        <Link href="/npcs"    className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">NPCs</Link>
        <Link href="/players" className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">Players</Link>
        <Link href="/maps"    className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">Maps</Link>
        <Link href="/magic"   className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">Magic</Link>
      </div>

      {/* The editable form — handles all state and autosave client-side */}
      <SessionForm session={session} />
    </div>
  );
}
