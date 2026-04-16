export const dynamic = 'force-dynamic';

import RavenBroadsheet, { type IssueAssembly } from '@/components/RavenBroadsheet';
import { getIssueDraft } from '@/lib/raven-issue-draft';
import { formatShireDate } from '@/lib/shire-date';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { RavenItem, RavenSectionId, RavenWeatherRow } from '@/lib/types';

interface AdProductRow {
  id: string;
  image_url: string;
  link: string;
  real_copy: string;
}

/**
 * Preview route — renders the current draft exactly as players will see it
 * after publish. No writes; reads from raven_issue_draft and joins
 * raven_ad_products on draft.ad_product_id.
 */
export default async function DmRavenPostPreviewPage() {
  await ensureSchema();

  const [draft, campaignRows, weatherRows] = await Promise.all([
    getIssueDraft(),
    query<{ raven_volume: number; raven_issue: number }>(
      `SELECT raven_volume, raven_issue FROM campaign WHERE id = 'default'`,
    ),
    query<RavenWeatherRow>(
      `SELECT * FROM raven_weather WHERE hex_id = 'default' LIMIT 1`,
    ),
  ]);

  const volume = campaignRows[0]?.raven_volume ?? 1;
  const issue = campaignRows[0]?.raven_issue ?? 1;
  const inFictionDate = draft.in_fiction_date || formatShireDate();

  // Synthesize RavenItems for each prose section that has body content. These
  // are not inserted anywhere — they exist only to feed the renderer.
  const now = new Date().toISOString();
  function synth(
    sectionId: RavenSectionId,
    headline: string,
    body: string,
  ): RavenItem | null {
    if (!body.trim()) return null;
    return {
      id: `preview-${sectionId}`,
      medium: 'broadsheet',
      body,
      headline: headline || null,
      sender: null,
      target_player: null,
      trust: 'official',
      tags: [],
      ad_image_url: null,
      ad_real_link: null,
      ad_real_copy: null,
      newsie_mp3: null,
      raven_volume: volume,
      raven_issue: issue,
      section_id: sectionId,
      published_at: now,
      created_at: now,
    };
  }

  const items: RavenItem[] = [
    synth('col1_lead', draft.col1_lead_headline, draft.col1_lead_body),
    synth('blood_moon', draft.blood_moon_headline, draft.blood_moon_body),
    synth('crimson_moon', draft.crimson_moon_headline, draft.crimson_moon_body),
    synth('opinion', draft.opinion_headline, draft.opinion_body),
  ].filter((x): x is RavenItem => x !== null);

  // Join ad product if set.
  let ad: IssueAssembly['ad'] = null;
  if (draft.ad_product_id) {
    const rows = await query<AdProductRow>(
      `SELECT id, image_url, link, real_copy FROM raven_ad_products WHERE id = $1`,
      [draft.ad_product_id],
    );
    if (rows.length > 0) {
      ad = {
        imageUrl: rows[0].image_url,
        link: rows[0].link,
        overlay: rows[0].real_copy,
      };
    }
  }

  const assembly: IssueAssembly = {
    bigHeadline: draft.big_headline,
    heroImageUrl: draft.hero_image_url || null,
    heroCaption: draft.hero_caption,
    ad,
    qotd: { text: draft.qotd_text, author: draft.qotd_author },
  };

  const weather: RavenWeatherRow = weatherRows[0] ?? {
    hex_id: 'default',
    condition: 'clear',
    temp_c: null,
    wind_label: null,
    wind_dir_deg: null,
    wind_speed_mph: null,
    updated_at: now,
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Match the editor page layout: same max-width, px-8, py-10 */}
      <div className="max-w-[1000px] mx-auto" style={{ padding: '40px 32px' }}>
        <div style={{ position: 'relative' }}>
          {/* Back to Editor circle — same position as the Preview circle
              on the draft page (absolute, top-right, outside the frame). */}
          <div style={{ position: 'absolute', top: 0, right: -90, zIndex: 10 }}>
            <a
              href="/dm/raven-post"
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'EB Garamond, serif',
                fontSize: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                textAlign: 'center',
                lineHeight: 1.3,
                border: '1px solid rgba(201,168,76,0.4)',
                color: '#ffffff',
                textDecoration: 'none',
              }}
            >
              Back to<br />Editor
            </a>
          </div>
          <RavenBroadsheet
            items={items}
            weather={weather}
            volume={volume}
            issue={issue}
            inFictionDate={inFictionDate}
            assembly={assembly}
          />
        </div>
      </div>
    </div>
  );
}
