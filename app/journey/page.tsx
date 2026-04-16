export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Image from 'next/image';
import { readdir, mkdir } from 'fs/promises';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session, Campaign } from '@/lib/types';
import JourneyClient from '@/components/JourneyClient';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/journey`;

async function getJourneyImages(): Promise<Record<string, string>> {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const files = await readdir(UPLOAD_DIR);
    const images: Record<string, string> = {};
    for (const f of files) {
      const m = f.match(/^(s\d+_(circle|bg)|campaign_bg|journal_bg)\.\w+$/);
      if (m) images[m[1]] = `/api/uploads/journey/${f}`;
    }
    return images;
  } catch {
    return {};
  }
}

export default async function PlayerJourneyPage() {
  await ensureSchema();
  const [sessions, imageMap, [campaign]] = await Promise.all([
    query<Session>('SELECT * FROM sessions ORDER BY number ASC'),
    getJourneyImages(),
    query<Campaign>('SELECT * FROM campaign LIMIT 1'),
  ]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">
      {/* Slim nav matching other player surfaces (raven-post style) */}
      <div
        className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-8 py-3 z-10 text-sm"
        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <Link href="/" title="Shadow of the Wolf" className="flex-shrink-0">
          <div className="relative rounded-full overflow-hidden" style={{ width: 30, height: 30 }}>
            <Image src="/images/invite/dice_home.png" alt="Home" fill className="object-cover" />
          </div>
        </Link>
        <span className="text-[var(--color-border)]">|</span>
        <span className="text-[var(--color-gold)] italic">Our story so far…</span>
      </div>

      <JourneyClient
        sessions={sessions}
        imageMap={imageMap}
        campaignBackground={campaign?.background ?? ''}
        readOnly
      />
    </div>
  );
}
