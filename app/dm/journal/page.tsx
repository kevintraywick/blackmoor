export const dynamic = 'force-dynamic';

import { readdir, mkdir } from 'fs/promises';
import DmNav from '@/components/DmNav';
import DmJournalClient from '@/components/DmJournalClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getSessionStats, type SessionStats } from '@/lib/journal-stats';
import type { Session, Campaign } from '@/lib/types';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/journey`;

async function getJournalBgImage(): Promise<string | null> {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const files = await readdir(UPLOAD_DIR);
    const match = files.find(f => /^journal_bg\.\w+$/.test(f));
    return match ? `/api/uploads/journey/${match}` : null;
  } catch {
    return null;
  }
}

export default async function DmJournalPage() {
  await ensureSchema();

  const [sessions, campaigns, journalBg] = await Promise.all([
    query<Session>(
      `SELECT * FROM sessions WHERE title IS NOT NULL AND title <> '' ORDER BY number DESC`
    ),
    query<Campaign>('SELECT * FROM campaign LIMIT 1'),
    getJournalBgImage(),
  ]);
  const campaign = campaigns[0] ?? null;

  // Bulk-load stats for every session in parallel — single round-trip page render
  const statsEntries = await Promise.all(
    sessions.map(async s => [s.id, await getSessionStats(s.id)] as [string, SessionStats])
  );
  const statsMap: Record<string, SessionStats> = Object.fromEntries(statsEntries);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="journal" />
      <DmJournalClient
        sessions={sessions}
        campaign={campaign}
        statsMap={statsMap}
        initialJournalBg={journalBg}
      />
    </div>
  );
}
