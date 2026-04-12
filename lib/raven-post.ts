import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { query, withTransaction } from './db';
import { ensureSchema } from './schema';
import { renderNewsie } from './elevenlabs';
import { sendSms } from './twilio';
import type { RavenItem, RavenMedium, RavenTrust } from './types';

// Library coords (Citadel Tree). v1 hardcoded; future versions support
// multiple registered locations.
export const LIBRARY_COORDS = { lat: 36.34289, lng: -88.85022, radius_m: 100 };
export const LIBRARY_LOCATION = 'library';

// 30-minute cooldown to absorb GPS jitter
const TRIGGER_COOLDOWN_MS = 30 * 60 * 1000;

// SMS body cap — 320 chars = 2 SMS segments
const SMS_BODY_MAX = 320;

interface PublishArgs {
  medium: RavenMedium;
  body: string;
  headline?: string | null;
  sender?: string | null;
  target_player?: string | null;
  trust?: RavenTrust;
  tags?: string[];
  ad_image_url?: string | null;
  ad_real_link?: string | null;
  ad_real_copy?: string | null;
}

/**
 * Insert a new raven_items row, then for broadsheets render the newsie audio
 * for the latest 3 headlines and update the row with the mp3 path.
 *
 * Returns the published row (with newsie_mp3 populated if successfully rendered).
 */
export async function publishItem(args: PublishArgs, client?: PoolClient): Promise<RavenItem> {
  await ensureSchema();
  const q = client
    ? <T>(sql: string, params?: unknown[]) => client.query(sql, params).then(r => r.rows as T[])
    : query;
  const id = randomUUID();

  const campaignRows = await q<{ raven_volume: number; raven_issue: number }>(
    `SELECT raven_volume, raven_issue FROM campaign WHERE id = 'default'`,
  );
  const vol = campaignRows[0]?.raven_volume ?? 1;
  const iss = campaignRows[0]?.raven_issue ?? 1;

  const rows = await q<RavenItem>(
    `INSERT INTO raven_items
       (id, medium, body, headline, sender, target_player, trust, tags,
        ad_image_url, ad_real_link, ad_real_copy, raven_volume, raven_issue)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      id,
      args.medium,
      args.body,
      args.headline ?? null,
      args.sender ?? null,
      args.target_player ?? null,
      args.trust ?? 'official',
      args.tags ?? [],
      args.ad_image_url ?? null,
      args.ad_real_link ?? null,
      args.ad_real_copy ?? null,
      vol,
      iss,
    ],
  );

  const item = rows[0];

  // For broadsheet items, advance the issue counter and render the newsie.
  if (args.medium === 'broadsheet') {
    await advanceIssueCounter();
    await renderNewsieForLatest(item.id);
  }

  return item;
}

async function advanceIssueCounter(): Promise<void> {
  await query(
    `UPDATE campaign
     SET raven_issue = CASE
       WHEN raven_issue + 1 > raven_issues_per_volume THEN 1
       ELSE raven_issue + 1
     END,
     raven_volume = CASE
       WHEN raven_issue + 1 > raven_issues_per_volume THEN raven_volume + 1
       ELSE raven_volume
     END
     WHERE id = 'default'`,
  );
}

/**
 * Render newsie audio for the most recent 3 broadsheet headlines and store
 * the public mp3 URL on the just-published item. Silent no-op on failure.
 */
async function renderNewsieForLatest(itemId: string): Promise<void> {
  const headlines = await query<{ headline: string }>(
    `SELECT headline FROM raven_items
     WHERE medium = 'broadsheet' AND headline IS NOT NULL
     ORDER BY published_at DESC
     LIMIT 3`,
  );

  if (headlines.length === 0) return;
  const result = await renderNewsie({ headlines: headlines.map(h => h.headline) });
  if (!result) return;

  await query(
    `UPDATE raven_items SET newsie_mp3 = $1 WHERE id = $2`,
    [result.mp3PublicUrl, itemId],
  );
}

/**
 * Geolocation entry callback. Pops the FIFO head of the library overheard
 * queue (if any), records delivery, sends SMS to the player, returns whether
 * anything was actually sent.
 *
 * Returns:
 *   - 'sent'      — popped a row and SMS was attempted and returned ok
 *   - 'cooldown'  — player triggered too recently, no-op
 *   - 'empty'     — queue is empty (or everything was already delivered to this player)
 *   - 'no-optin'  — player has not opted into SMS or has no phone
 *   - 'no-twilio' — Twilio is not configured, budget paused, or send failed silently
 */
export async function triggerOverheard(playerId: string): Promise<
  'sent' | 'cooldown' | 'empty' | 'no-optin' | 'no-twilio'
> {
  await ensureSchema();

  // Cooldown check
  const triggers = await query<{ last_at: string }>(
    `SELECT last_at FROM raven_overheard_triggers
     WHERE player_id = $1 AND location = $2`,
    [playerId, LIBRARY_LOCATION],
  );
  if (triggers.length > 0) {
    const last = new Date(triggers[0].last_at).getTime();
    if (Date.now() - last < TRIGGER_COOLDOWN_MS) return 'cooldown';
  }

  // Player opt-in + phone check
  const players = await query<{ sms_phone: string | null; sms_optin: boolean }>(
    `SELECT sms_phone, sms_optin FROM player_sheets WHERE id = $1`,
    [playerId],
  );
  if (players.length === 0 || !players[0].sms_optin || !players[0].sms_phone) {
    // Still update the trigger so we don't spam ourselves checking
    await upsertTrigger(playerId);
    return 'no-optin';
  }
  const phone = players[0].sms_phone;

  // Pop the next undelivered queue row inside a transaction to avoid races
  const popped = await withTransaction(async (client) => {
    const result = await client.query<{ id: string; body: string }>(
      `SELECT q.id, q.body
       FROM raven_overheard_queue q
       WHERE q.location = $1
         AND NOT EXISTS (
           SELECT 1 FROM raven_overheard_deliveries d
           WHERE d.player_id = $2 AND d.queue_id = q.id
         )
       ORDER BY q.position ASC, q.created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [LIBRARY_LOCATION, playerId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    await client.query(
      `INSERT INTO raven_overheard_deliveries (player_id, queue_id) VALUES ($1, $2)`,
      [playerId, row.id],
    );
    return row;
  });

  if (!popped) {
    await upsertTrigger(playerId);
    return 'empty';
  }

  // Always update the trigger so cooldown applies even on send failure
  await upsertTrigger(playerId);

  const smsBody = `Overheard at the library — "${popped.body}"`.slice(0, SMS_BODY_MAX);
  const sent = await sendSms({ to: phone, body: smsBody });
  return sent ? 'sent' : 'no-twilio';
}

async function upsertTrigger(playerId: string): Promise<void> {
  await query(
    `INSERT INTO raven_overheard_triggers (player_id, location, last_at)
     VALUES ($1, $2, now())
     ON CONFLICT (player_id, location)
     DO UPDATE SET last_at = now()`,
    [playerId, LIBRARY_LOCATION],
  );
}
