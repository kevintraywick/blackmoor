export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Image from 'next/image';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import RavenPostPlayer from '@/components/RavenPostPlayer';
import type { IssueAssembly } from '@/components/RavenBroadsheet';
import { formatShireDate } from '@/lib/shire-date';
import type { RavenItem, RavenWeatherRow, RavenIssue } from '@/lib/types';

// The Raven Post is the PUBLIC broadsheet — visible to all players.
// Personal items (ravens, sendings) belong on the player's own sheet page,
// not here. Only broadsheet headlines, ads, and weather appear.

interface IssueInfo {
  raven_volume: number;
  raven_issue: number;
  published_at: string;
}

interface AdProductRow {
  id: string;
  image_url: string;
  link: string;
  real_copy: string;
}

export default async function RavenPostPage() {
  await ensureSchema();

  const [items, weatherRows, latestIssueRows, issueRows] = await Promise.all([
    query<RavenItem>(
      `SELECT * FROM raven_items
       WHERE medium IN ('broadsheet', 'ad')
       ORDER BY published_at DESC
       LIMIT 200`,
    ),
    query<RavenWeatherRow>(`SELECT * FROM raven_weather WHERE hex_id = 'default'`),
    query<RavenIssue>(
      `SELECT * FROM raven_issues
       WHERE campaign_id = 'default'
       ORDER BY published_at DESC
       LIMIT 1`,
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
    wind_dir_deg: null,
    wind_speed_mph: null,
    updated_at: new Date().toISOString(),
  };

  // Display the latest published issue. If nothing's been published yet,
  // fall back to today's date + issue 1·1 + hardcoded assembly defaults.
  const latestIssue = latestIssueRows[0] ?? null;
  const volume = latestIssue?.volume ?? 1;
  const issue = latestIssue?.issue ?? 1;
  const inFictionDate = latestIssue?.in_fiction_date || formatShireDate();

  // Resolve the ad product for the latest issue, if any.
  let assembly: IssueAssembly | undefined;
  if (latestIssue) {
    let ad: IssueAssembly['ad'] = null;
    if (latestIssue.ad_product_id) {
      const adRows = await query<AdProductRow>(
        `SELECT id, image_url, link, real_copy FROM raven_ad_products WHERE id = $1`,
        [latestIssue.ad_product_id],
      );
      if (adRows.length > 0) {
        ad = {
          imageUrl: adRows[0].image_url,
          link: adRows[0].link,
          overlay: adRows[0].real_copy,
        };
      }
    }
    assembly = {
      bigHeadline: latestIssue.big_headline,
      heroImageUrl: latestIssue.hero_image_url || null,
      heroCaption: latestIssue.hero_caption,
      ad,
      qotd: { text: latestIssue.qotd_text, author: latestIssue.qotd_author },
    };
  }

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
          assembly={assembly}
        />
      </div>
    </div>
  );
}
