export const dynamic = 'force-dynamic';

import { readdir, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session, Campaign } from '@/lib/types';
import DmNav from '@/components/DmNav';
import JourneyClient from '@/components/JourneyClient';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/journey`;

async function getJourneyImages(): Promise<Record<string, string>> {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const files = await readdir(UPLOAD_DIR);
    const images: Record<string, string> = {};
    for (const f of files) {
      const m = f.match(/^(s\d+_(circle|bg)|campaign_bg|journal_bg)\.\w+$/);
      if (!m) continue;
      // Append file mtime as ?v= so the browser re-fetches when the DM
      // replaces an image at the same filename.
      const mtime = await stat(join(UPLOAD_DIR, f)).then(s => s.mtimeMs).catch(() => Date.now());
      images[m[1]] = `/api/uploads/journey/${f}?v=${Math.floor(mtime)}`;
    }
    return images;
  } catch {
    return {};
  }
}

export default async function JourneyPage() {
  await ensureSchema();
  const [sessions, imageMap, [campaign]] = await Promise.all([
    query<Session>('SELECT * FROM sessions ORDER BY number ASC'),
    getJourneyImages(),
    query<Campaign>('SELECT * FROM campaign LIMIT 1'),
  ]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="journey" />
      <JourneyClient sessions={sessions} imageMap={imageMap} campaignBackground={campaign?.background ?? ''} campaignAudioUrl={campaign?.audio_url ?? ''} />
    </div>
  );
}
