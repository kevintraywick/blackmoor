export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withTransaction } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { getIssueDraft } from '@/lib/raven-issue-draft';
import { formatShireDate } from '@/lib/shire-date';
import type { RavenSectionId } from '@/lib/types';

const CAMPAIGN_ID = 'default';

// Prose sections that publish as raven_items rows. Sections without body
// content are skipped. `big_headline` is intentionally NOT here — it lives
// on raven_issues as an assembly field (not prose).
const PROSE_SECTIONS: Array<{
  section: Exclude<RavenSectionId, 'big_headline'>;
  headlineField: 'col1_lead_headline' | 'blood_moon_headline' | 'crimson_moon_headline' | 'opinion_headline';
  bodyField: 'col1_lead_body' | 'blood_moon_body' | 'crimson_moon_body' | 'opinion_body';
}> = [
  { section: 'col1_lead',    headlineField: 'col1_lead_headline',    bodyField: 'col1_lead_body' },
  { section: 'blood_moon',   headlineField: 'blood_moon_headline',   bodyField: 'blood_moon_body' },
  { section: 'crimson_moon', headlineField: 'crimson_moon_headline', bodyField: 'crimson_moon_body' },
  { section: 'opinion',      headlineField: 'opinion_headline',      bodyField: 'opinion_body' },
];

// POST /api/raven-post/issue-publish — publish the current draft.
//   1. Validate big_headline + all prose bodies are non-empty.
//   2. In a transaction:
//      - INSERT one raven_items row per prose section with content
//      - INSERT raven_issues row for the assembly
//      - Bump campaign.raven_issue (roll to next volume at issues_per_volume)
//      - Wipe prose fields in raven_issue_draft; preserve hero/ad/qotd
export async function POST() {
  try {
    await ensureSchema();
    const draft = await getIssueDraft();

    // Validate required fields
    if (!draft.big_headline.trim()) {
      return NextResponse.json({ error: 'big_headline is required' }, { status: 400 });
    }
    for (const { bodyField } of PROSE_SECTIONS) {
      if (!draft[bodyField].trim()) {
        return NextResponse.json(
          { error: `${bodyField} is required to publish` },
          { status: 400 },
        );
      }
    }

    const inFictionDate = draft.in_fiction_date || formatShireDate();

    const result = await withTransaction(async client => {
      // Read current campaign issue counters under the tx so the bump is atomic.
      const campaignRes = await client.query(
        `SELECT raven_volume, raven_issue, raven_issues_per_volume FROM campaign WHERE id = $1 FOR UPDATE`,
        [CAMPAIGN_ID],
      );
      const { raven_volume: volume, raven_issue: issue, raven_issues_per_volume: perVol } =
        campaignRes.rows[0] as { raven_volume: number; raven_issue: number; raven_issues_per_volume: number };

      // Insert prose items
      for (const { section, headlineField, bodyField } of PROSE_SECTIONS) {
        const body = draft[bodyField].trim();
        if (!body) continue;
        await client.query(
          `INSERT INTO raven_items
             (id, medium, body, headline, trust, tags,
              raven_volume, raven_issue, section_id, source)
           VALUES ($1, 'broadsheet', $2, $3, 'official', '{}', $4, $5, $6, 'manual')`,
          [
            randomUUID(),
            body,
            draft[headlineField].trim() || null,
            volume,
            issue,
            section,
          ],
        );
      }

      // Insert assembly record
      const issueId = randomUUID();
      await client.query(
        `INSERT INTO raven_issues
           (id, campaign_id, volume, issue, big_headline, hero_image_url, hero_caption,
            ad_product_id, qotd_text, qotd_author, in_fiction_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          issueId,
          CAMPAIGN_ID,
          volume,
          issue,
          draft.big_headline.trim(),
          draft.hero_image_url,
          draft.hero_caption,
          draft.ad_product_id,
          draft.qotd_text,
          draft.qotd_author,
          inFictionDate,
        ],
      );

      // Bump counters — roll volume at issues_per_volume
      const nextIssue = issue + 1 > perVol ? 1 : issue + 1;
      const nextVolume = issue + 1 > perVol ? volume + 1 : volume;
      await client.query(
        `UPDATE campaign SET raven_volume = $1, raven_issue = $2 WHERE id = $3`,
        [nextVolume, nextIssue, CAMPAIGN_ID],
      );

      // Preserve all draft content so the DM can tweak and republish.
      // Only wipe in_fiction_date so the next publish picks up today's date.
      await client.query(
        `UPDATE raven_issue_draft SET
           in_fiction_date = '',
           updated_at = NOW()
         WHERE campaign_id = $1`,
        [CAMPAIGN_ID],
      );

      return { issueId, volume, issue, nextVolume, nextIssue };
    });

    return NextResponse.json({
      ok: true,
      issue_id: result.issueId,
      published_volume: result.volume,
      published_issue: result.issue,
      next_volume: result.nextVolume,
      next_issue: result.nextIssue,
    });
  } catch (err) {
    console.error('[issue-publish] POST failed', err);
    return NextResponse.json({ error: (err as Error).message ?? 'publish failed' }, { status: 500 });
  }
}
