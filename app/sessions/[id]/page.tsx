// Server component — fetches this session from DB, passes it to the client form
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session, Npc } from '@/lib/types';
import SessionForm from '@/components/SessionForm';

// Always render fresh — session data changes frequently
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: Props) {
  const { id } = await params;
  await ensureSchema();

  // Fetch session and all NPCs in parallel
  const [rows, allNpcs] = await Promise.all([
    query<Session>('SELECT * FROM sessions WHERE id = $1', [id]),
    query<Npc>('SELECT * FROM npcs ORDER BY created_at ASC'),
  ]);
  const session = rows[0];

  // Show 404 if session doesn't exist
  if (!session) notFound();

  const label = session.title ? `#${session.number} ${session.title}` : `Session #${session.number}`;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">

      {/* Sticky top bar with breadcrumb nav and save status (save status is in SessionForm) */}
      <nav className="sticky top-0 bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)] px-8 py-2.5 flex items-center gap-2 z-10 text-sm">
        <Link href="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors no-underline">← Home</Link>
        <span className="text-[var(--color-border)] select-none">·</span>
        <Link href="/dm" className="text-[var(--color-text)] hover:text-[var(--color-gold)] transition-colors no-underline">Sessions</Link>
        <span className="text-[var(--color-border)] select-none">·</span>
        <span className="text-[var(--color-gold)] font-semibold">{label}</span>
        <span className="text-[var(--color-border)] select-none">·</span>
        <Link href="/players" className="text-[var(--color-text)] hover:text-[var(--color-gold)] transition-colors no-underline">Players</Link>
        <span className="text-[var(--color-border)] select-none">·</span>
        <Link href={`/dm/maps?session=${id}`} className="text-[var(--color-text)] hover:text-[var(--color-gold)] transition-colors no-underline">Maps</Link>
        <span className="text-[var(--color-border)] select-none">·</span>
        <Link href="/dm/magic" className="text-[var(--color-text)] hover:text-[var(--color-gold)] transition-colors no-underline">Magic</Link>
        <span className="text-[var(--color-border)] select-none">·</span>
        <Link href="/dm/marketplace" className="text-[var(--color-text)] hover:text-[var(--color-gold)] transition-colors no-underline">Marketplace</Link>
        <span className="text-[var(--color-border)] select-none">·</span>
        <Link href="/dm/poisons" className="text-[var(--color-text)] hover:text-[var(--color-gold)] transition-colors no-underline">Poisons & Traps</Link>
      </nav>

      {/* The editable form — handles all state and autosave client-side */}
      <SessionForm session={session} allNpcs={allNpcs} />
    </div>
  );
}
