export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Image from 'next/image';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import RavenPostPlayer from '@/components/RavenPostPlayer';
import type { RavenItem, RavenWeatherRow, Campaign } from '@/lib/types';

// The Raven Post is the PUBLIC broadsheet — visible to all players.
// Personal items (ravens, sendings) belong on the player's own sheet page,
// not here. Only broadsheet headlines, ads, and weather appear.

interface IssueInfo {
  raven_volume: number;
  raven_issue: number;
  published_at: string;
}

export default async function RavenPostPage() {
  await ensureSchema();

  const [items, weatherRows, campaignRows, issueRows] = await Promise.all([
    query<RavenItem>(
      `SELECT * FROM raven_items
       WHERE medium IN ('broadsheet', 'ad')
       ORDER BY published_at DESC
       LIMIT 200`,
    ),
    query<RavenWeatherRow>(`SELECT * FROM raven_weather WHERE hex_id = 'default'`),
    query<Campaign & { raven_volume: number; raven_issue: number }>(
      `SELECT * FROM campaign WHERE id = 'default'`,
    ),
    query<IssueInfo>(
      `SELECT DISTINCT raven_volume, raven_issue, MAX(published_at) as published_at
       FROM raven_items
       WHERE medium IN ('broadsheet', 'ad')
         AND raven_volume IS NOT NULL AND raven_issue IS NOT NULL
       GROUP BY raven_volume, raven_issue
       ORDER BY MAX(published_at) DESC
       LIMIT 20`,
    ),
  ]);

  const weather: RavenWeatherRow = weatherRows[0] ?? {
    hex_id: 'default',
    condition: 'clear',
    temp_c: null,
    wind_label: null,
    updated_at: new Date().toISOString(),
  };

  const volume = campaignRows[0]?.raven_volume ?? 1;
  const issue = campaignRows[0]?.raven_issue ?? 1;

  // v1 placeholder for an in-fiction date — eventually this comes from the
  // game-clock formatter once that's wired in.
  const inFictionDate = '14th of Mirtul, CY 581';

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">
      {/* Slim nav bar matching other player surfaces */}
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
        <span className="text-[var(--color-gold)]">The Raven Post</span>
      </div>

      <div className="max-w-[860px] mx-auto px-4 py-8">
        <RavenPostPlayer
          items={items}
          weather={weather}
          volume={volume}
          issue={issue}
          inFictionDate={inFictionDate}
          issues={issueRows}
        />
      </div>
    </div>
  );
}
