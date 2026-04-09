# Railway Cron Setup — World AI Loop

## Overview

The World AI loop fires every 3 hours via a Railway Cron job that hits
`POST /api/raven-post/world-ai/tick`. Each tick reads campaign state,
runs Haiku triage, drafts proposals with Sonnet, and writes them to the
DM's curation pane.

## Prerequisites

- Blackmoor app deployed on Railway with the `feat/raven-post` changes
- `ANTHROPIC_API_KEY` set on the Railway service
- (Optional) `OPENAI_API_KEY` for pgvector embeddings
- (Optional) `WORLD_AI_CRON_SECRET` for cron auth

## Setup Steps

### 1. Set the cron secret

Add a shared secret so only your cron job can trigger ticks:

```bash
railway variables set WORLD_AI_CRON_SECRET=<generate-a-random-string>
```

Use any random string (e.g., `openssl rand -hex 32`).

### 2. Create the Cron service in Railway

1. Open your Railway project dashboard
2. Click **+ New** → **Cron Job**
3. Set the schedule to `0 */3 * * *` (every 3 hours on the hour)
4. Set the command:
   ```bash
   curl -s -X POST \
     https://<your-app-domain>/api/raven-post/world-ai/tick \
     -H "Authorization: Bearer $WORLD_AI_CRON_SECRET" \
     -H "Content-Type: application/json"
   ```
5. In the cron service's variables, add `WORLD_AI_CRON_SECRET` with the
   same value as the app service

### 3. Verify

After the first scheduled run (or trigger manually from the DM page):

```bash
curl -s https://<your-app-domain>/api/raven-post/world-ai/ticks | head -c 200
```

You should see a tick entry with `trigger: "auto"` and `proposals_generated >= 0`.

## Fallback: pg_cron

If Railway Cron is not available on your plan:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the tick
SELECT cron.schedule(
  'world-ai-tick',
  '0 */3 * * *',
  $$SELECT net.http_post(
    url := 'https://<your-app-domain>/api/raven-post/world-ai/tick',
    headers := '{"Authorization": "Bearer <your-secret>", "Content-Type": "application/json"}'::jsonb
  )$$
);
```

Note: pg_cron + pg_net may not be available on all Railway Postgres plans.

## Fallback: External heartbeat

Use [cron-job.org](https://cron-job.org) (free tier):

1. Create a new cron job
2. URL: `https://<your-app-domain>/api/raven-post/world-ai/tick`
3. Method: POST
4. Headers: `Authorization: Bearer <your-secret>`
5. Schedule: every 3 hours
6. Notification: email on failure

## Manual trigger

The DM can always trigger a tick from `/dm/raven-post` using the
"⟳ Generate now" button. This bypasses the cron schedule and the
stale-check (manual ticks always run).

## Pausing

To pause the loop without removing the cron:

- Click "⏸ Pause loop" on `/dm/raven-post`, OR
- `curl -X PATCH -H "Content-Type: application/json" -d '{"paused":true}' https://<your-app-domain>/api/raven-post/world-ai/state`

Paused ticks return `{ skipped: true, reason: "paused" }` and consume
no API credits.
