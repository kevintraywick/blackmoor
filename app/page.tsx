// Always render at request time — never pre-render at build (needs live DB)
export const dynamic = 'force-dynamic';

// Server component — runs on the server, can query the DB directly.
// No 'use client' here means Next.js renders this as HTML before sending to browser.
import Image from 'next/image';
import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session } from '@/lib/types';
import SessionList from '@/components/SessionList';
import PlayerCircles from '@/components/PlayerCircle';

// Fetch sessions at request time (not cached) so the list is always fresh
async function getSessions() {
  await ensureSchema();
  return query<Session>('SELECT * FROM sessions ORDER BY sort_order ASC, number ASC');
}

export default async function HomePage() {
  const sessions = await getSessions();

  return (
    // Full-viewport splash image container
    <div className="relative w-full bg-[#2a3140] overflow-hidden" style={{ minHeight: '138vh' }}>

      {/* Campaign splash art — tall crop so it feels cinematic */}
      <div className="absolute inset-0 w-full" style={{ height: '138vh' }}>
        <Image
          src="/SOTW_splash.png"
          alt="Shadow of the Wolf"
          fill
          className="object-contain object-top"
          priority
          style={{ transform: 'translateY(-50px)' }}
        />
      </div>

      {/* Overlay nav — absolutely positioned top-left over the splash image */}
      <nav className="absolute top-4 left-4 flex flex-col gap-2 max-h-[calc(100vh-2rem)] overflow-y-auto z-10">

        {/* Session list with drag-reorder (client component handles interactivity) */}
        <SessionList initial={sessions} />

        {/* Page nav links */}
        <div className="mt-5 flex flex-col gap-1">
          <NavLink href="/" active>Sessions</NavLink>
          <NavLink href="/players">Players</NavLink>
          <NavLink href="/npcs" disabled>NPCs</NavLink>
          <NavLink href="/maps" disabled>Maps</NavLink>
          <NavLink href="/magic" disabled>Magic</NavLink>
          <NavLink href="/marketplace" disabled>Marketplace</NavLink>
        </div>

        {/* Player portrait circles — client component for onClick */}
        <PlayerCircles />

        {/* Wolf howl audio plays when Players link clicked */}
        <audio id="howl" src="/audio/wolf-howl.mp3" preload="auto" />
      </nav>
    </div>
  );
}

// Reusable nav link with active and disabled state styling
function NavLink({ href, children, active, disabled }: { href: string; children: React.ReactNode; active?: boolean; disabled?: boolean }) {
  if (disabled) {
    return (
      <span
        title="Coming soon"
        className="px-4 py-1.5 rounded text-sm border text-center border-[#2a2420] text-[#3d3530] cursor-not-allowed select-none"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`px-4 py-1.5 rounded text-sm border text-center no-underline transition-colors
        ${active
          ? 'text-[#c9a84c] border-[#c9a84c]'
          : 'text-[#8a7d6e] border-[#3d3530] hover:text-[#c9a84c] hover:border-[#c9a84c]'
        }`}
    >
      {children}
    </Link>
  );
}
