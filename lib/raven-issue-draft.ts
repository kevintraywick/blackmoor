import { query } from './db';
import { ensureSchema } from './schema';
import type { RavenIssueDraft } from './types';

// v1 is single-campaign. Hardcoding the campaign id matches the pattern used
// elsewhere (see `lib/raven-post.ts::publishItem` and lib/schema.ts seed rows).
const DEFAULT_CAMPAIGN_ID = 'default';

/**
 * Fetch the current issue draft for a campaign. Creates an empty row on
 * first access so subsequent saves can assume the row exists.
 */
export async function getIssueDraft(campaignId: string = DEFAULT_CAMPAIGN_ID): Promise<RavenIssueDraft> {
  await ensureSchema();
  const rows = await query<RavenIssueDraft>(
    `SELECT * FROM raven_issue_draft WHERE campaign_id = $1`,
    [campaignId],
  );
  if (rows.length > 0) return rows[0];

  const inserted = await query<RavenIssueDraft>(
    `INSERT INTO raven_issue_draft (campaign_id) VALUES ($1) RETURNING *`,
    [campaignId],
  );
  return inserted[0];
}

// Fields the DM editor can patch. Omitted: campaign_id (PK) and updated_at
// (set server-side). Typed as a partial so callers send only dirty fields.
export type IssueDraftPatch = Partial<Omit<RavenIssueDraft, 'campaign_id' | 'updated_at'>>;

// Allowlist of patchable columns — protects against arbitrary column writes
// from a forged PUT body.
const PATCHABLE_COLUMNS: (keyof IssueDraftPatch)[] = [
  'big_headline',
  'col1_lead_headline',
  'col1_lead_body',
  'blood_moon_headline',
  'blood_moon_body',
  'crimson_moon_headline',
  'crimson_moon_body',
  'opinion_headline',
  'opinion_body',
  'hero_image_url',
  'hero_caption',
  'ad_product_id',
  'qotd_text',
  'qotd_author',
  'in_fiction_date',
];

/**
 * Merge-upsert the draft for a campaign. Only columns in the allowlist are
 * written. No-ops if `patch` is empty. Bumps `updated_at`.
 */
export async function saveIssueDraft(
  patch: IssueDraftPatch,
  campaignId: string = DEFAULT_CAMPAIGN_ID,
): Promise<RavenIssueDraft> {
  await ensureSchema();
  await getIssueDraft(campaignId); // ensures row exists

  const sets: string[] = [];
  const params: unknown[] = [campaignId];
  let p = 2;
  for (const col of PATCHABLE_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(patch, col)) {
      sets.push(`${col} = $${p}`);
      params.push(patch[col] ?? null);
      p++;
    }
  }

  if (sets.length === 0) {
    const rows = await query<RavenIssueDraft>(
      `SELECT * FROM raven_issue_draft WHERE campaign_id = $1`,
      [campaignId],
    );
    return rows[0];
  }

  sets.push(`updated_at = NOW()`);
  const rows = await query<RavenIssueDraft>(
    `UPDATE raven_issue_draft SET ${sets.join(', ')} WHERE campaign_id = $1 RETURNING *`,
    params,
  );
  return rows[0];
}
