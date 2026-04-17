# Common v3 — Multi-Tenancy Refactor

**Date:** 2026-04-11
**Status:** ready (depends on Common v2 shipping first)
**Owner:** Kevin (@kevin / @thewolf)
**Estimate:** 1.5–2 weeks focused work

## Goal

Remove the single-campaign singleton assumption. Introduce a real `campaigns` table. Fan `campaign_id` out across every scoped table. Keep Shadow of the Wolf functioning throughout.

**End state of v3:** the refactor is complete in code, but URLs are unchanged and the old singleton `campaign` table has not been dropped yet. That "flip day" is Common v4, deliberately separated so the risky cutover is its own ship moment.

## Non-goals

- No URL changes (those are v4).
- No dropping of the old singleton (v4).
- No Common World tables, hexes, or entities (v5+).
- No public signup (v13).

## The key decision — dev DB path

Kevin reconsidered his earlier "no dev DB" stance. **v3 uses a dedicated dev DB on Railway.** The earlier strangler-fig plan was gymnastics to avoid the $5/mo of a separate Postgres service, at a cost of ~25% more refactor work and two-code-path maintenance. Not worth it.

### Dev DB setup (part of v3 prep)

1. Create a second Postgres service on Railway, in the same project. Name it `blackmoor-dev-db`.
2. Copy the `DATABASE_PUBLIC_URL` from the new service.
3. In the `~/blackmoor-common` worktree, create `.env.local` with that URL.
4. Seed the dev DB from a recent production backup (commit 4fa370f's nightly backup is exactly this — grab the latest artifact).
5. Verify the dev DB loads and the Shadow data is present in the dev environment.

The production DB is **never** touched during v3 development. Only on merge day (which is v4's responsibility) does the refactor hit production.

## Worktree + branch setup

From the existing `~/blackmoor` folder (main, Shadow production):

```
git status                                   # must be clean
git worktree add ../blackmoor-common -b feat/common
cd ../blackmoor-common
npm install                                   # separate node_modules
# create .env.local pointing at dev DB
```

From now until v4, all Common v3 work happens in `~/blackmoor-common`. Shadow maintenance continues in `~/blackmoor`. Both folders serve their own dev server (ports 3000 and 3001).

### Rebasing discipline (per Kevin's Q5 answer)

Every time a Shadow hotfix lands on main, from `~/blackmoor-common`:

```
git fetch origin
git rebase origin/main
```

Kevin drives; I walk him through the first three rebases. After that, muscle memory. If a rebase hits a conflict, don't `--abort` — pause and ask.

## Schema changes

### New tables

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   TEXT UNIQUE NOT NULL,          -- 'shadow'
  dm_id                  UUID NOT NULL REFERENCES dms(id) ON DELETE RESTRICT,
  name                   TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  background             TEXT NOT NULL DEFAULT '',
  world                  TEXT NOT NULL DEFAULT '',
  -- game clock moves here from the singleton campaign row
  game_time_seconds      BIGINT NOT NULL DEFAULT 0,
  clock_paused           BOOLEAN NOT NULL DEFAULT true,
  clock_last_advanced_at BIGINT NOT NULL DEFAULT 0,
  -- settings columns from the old campaign table
  quorum                 INTEGER NOT NULL DEFAULT 5,
  dm_email               TEXT NOT NULL DEFAULT '',
  quorum_notified        JSONB NOT NULL DEFAULT '[]',
  home_splash_path       TEXT NOT NULL DEFAULT '',
  home_banner_path       TEXT NOT NULL DEFAULT '',
  narrative_notes        TEXT NOT NULL DEFAULT '',
  raven_volume           INTEGER NOT NULL DEFAULT 1,
  raven_issue            INTEGER NOT NULL DEFAULT 1,
  -- v3 new: economy treasury
  treasury_gp            INTEGER NOT NULL DEFAULT 0,
  treasury_sp            INTEGER NOT NULL DEFAULT 0,
  treasury_cp            INTEGER NOT NULL DEFAULT 0,
  -- campaign lifecycle
  status                 TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','paused','dormant','ended')),
  ended_at               BIGINT,
  created_at             BIGINT NOT NULL,
  updated_at             BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS campaigns_dm_id_idx ON campaigns (dm_id);
-- Enforce "one active campaign per DM" at the DB layer.
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_one_active_per_dm
  ON campaigns (dm_id) WHERE status = 'active';
```

### Seed row

```sql
INSERT INTO campaigns (
  slug, dm_id, name, description, background, world,
  game_time_seconds, clock_paused, clock_last_advanced_at,
  quorum, dm_email, quorum_notified, home_splash_path, home_banner_path,
  narrative_notes, raven_volume, raven_issue,
  status, created_at, updated_at
)
SELECT
  'shadow',
  (SELECT id FROM dms WHERE handle = '@thewolf'),
  name, description, background, world,
  game_time_seconds, clock_paused, clock_last_advanced_at,
  quorum, dm_email, quorum_notified, home_splash_path, home_banner_path,
  narrative_notes, raven_volume, raven_issue,
  'active', <now>, <now>
FROM campaign
LIMIT 1
ON CONFLICT (slug) DO NOTHING;
```

The singleton `campaign` row is read-only during v3 — it still exists and old code paths still use it. The new `campaigns.shadow` row is a mirror. During v3 work, these must stay consistent: any write the old code makes to `campaign.game_time_seconds` must also land on `campaigns.shadow.game_time_seconds`. The simplest way to enforce this is a DB trigger, but we can also just do it in the `lib/game-clock.ts` helpers. I'll use helper-level updates to keep it transparent.

### Scoped tables — nullable `campaign_id` (additive)

Every table gains a **nullable** `campaign_id UUID REFERENCES campaigns(id)` column. Nullable during v3, enforced in v4.

Tables that get the column:

- `sessions`
- `player_sheets`
- `players`
- `maps`
- `map_builds`, `map_build_levels`, `map_build_bookmarks`, `map_build_assets`
- `items`
- `npcs`
- `invitations`
- `dm_messages`
- `poison_status`
- `session_events`
- `player_changes`
- `player_presence`
- `availability`
- `raven_items`, `raven_reads`, `raven_overheard_queue`, `raven_overheard_deliveries`, `raven_overheard_triggers`, `raven_weather`, `raven_budget_caps`, `raven_spend_ledger`
- `world_map` (becomes `world_maps` logically — but we keep the table name; the singleton row gets a `campaign_id`)
- `world_hexes`
- `world_entities`

**Backfill** after the column is added:

```sql
UPDATE <table>
  SET campaign_id = (SELECT id FROM campaigns WHERE slug = 'shadow')
  WHERE campaign_id IS NULL;
```

One UPDATE per table, wrapped in a transaction, idempotent via the `WHERE campaign_id IS NULL` clause.

### The `getCampaignId()` helper

New in `lib/auth.ts` or a new `lib/campaign.ts`:

```ts
// Server-only. Returns the active campaign's UUID for the current request.
// In v3, there's exactly one campaign (shadow), so this returns that
// campaign's id for every caller. In v4, it starts reading from the URL
// slug ([campaignSlug] route segment).
export async function getCampaignId(): Promise<string>
```

Every `lib/*.ts` helper that writes to a scoped table gains a `campaignId` parameter. Every API route passes `await getCampaignId()` through. The migration of helpers is the bulk of the v3 work.

## Route changes during v3

**None.** URLs stay exactly as they are today. The refactor is invisible to Shadow players and to Kevin himself during normal use. The only visible change is that Shadow sessions start writing rows with `campaign_id` populated, and reads start filtering on `campaign_id`.

## Step-by-step units of work

Each step is individually committable and leaves the branch in a runnable state against the dev DB.

1. **Provision dev DB on Railway.** Create the service, copy the URL, set it in `~/blackmoor-common/.env.local`, run the dev server against it, confirm Shadow data is there.
2. **Create the worktree + branch.** `git worktree add ../blackmoor-common -b feat/common`.
3. **Add the `campaigns` table + index.** Add to `lib/schema.ts`. Restart dev server. Verify the table appears.
4. **Seed the `shadow` campaign row.** Either via `ensureSchema` or a one-off script. Verify the row exists.
5. **Add nullable `campaign_id` column to every scoped table.** One big DDL block. Backfill via UPDATE. Verify a sample table has the column populated.
6. **Write `getCampaignId()` helper.** Trivial for v3 (returns the one shadow UUID). Unit test it.
7. **Migrate `lib/db.ts` read helpers.** `query<T>` and friends gain no new args, but the helpers above them start passing `campaign_id` through.
8. **Migrate `lib/world.ts`.** Every function gains a `campaignId` parameter. Call sites updated in lockstep. This is ~239 lines of changes plus call sites.
9. **Migrate `lib/raven-post.ts` + `lib/world-ai-*.ts`.** These are the densest surface. Same pattern.
10. **Migrate scoped API routes — reads.** Pass `campaignId` into every read. Tests pass.
11. **Migrate scoped API routes — writes.** Writes now populate `campaign_id`. Old code paths still work if they happen to write NULL, because the column is still nullable.
12. **Consistency check.** Write a script that scans every scoped table and asserts `COUNT(*) WHERE campaign_id IS NULL = 0`. Run it daily during v3 development.
13. **Update `lib/game-clock.ts` dual-write.** The old `campaign` singleton and the new `campaigns.shadow` row stay in sync for game_time_seconds, clock_paused, clock_last_advanced_at. This is the only place the dual-write matters.
14. **Run full smoke test in dev DB.** Everything Kevin does in Shadow on Wednesday night should work end-to-end against the dev DB. Player sheets, session advance, long rest, map operations, raven post.
15. **Write v4 plan doc.** Before closing v3, the v4 flip plan must exist and be reviewable.

## Verification

- Every scoped table has a fully-populated `campaign_id` column in the dev DB.
- `grep -n "FROM campaign\b" lib/ app/` returns only the `lib/game-clock.ts` dual-write site.
- `npm run lint` clean.
- `npx tsc --noEmit 2>&1 | grep -v ".next/types"` clean.
- `npm run build` succeeds against the dev DB.
- Kevin can run a full mock session from `/dm` → `/dm/initiative` → `/dm/players/ashton` without any visible difference from main.
- The consistency check script reports zero NULL `campaign_id` rows.

## Rollback

v3 changes are all additive at the schema level. To roll back:

1. Discard the `feat/common` branch (or archive it).
2. Drop the new tables and columns on the dev DB, or destroy the dev DB entirely.
3. Main is untouched. Production is untouched. Shadow keeps running.

The dev DB's disposability is the single biggest safety margin v3 has.

## What v4 inherits

When v3 ships, v4 has:
- A complete set of `campaign_id`-aware helpers and routes.
- A `campaigns` table with the shadow row populated.
- Every scoped DB row tagged with the shadow campaign_id.
- No changes to the old singleton `campaign` row (still there).

v4 flips `campaign_id` to NOT NULL, restructures routes to `/dm/[slug]/*`, drops the old singleton. That's the cutover day, done against production for the first time. It's a small, clearly-bounded PR — the dangerous work is all in v3, the one-shot flip is in v4.

## Open questions

Resolved 2026-04-16:

`Q1.` **Dev DB confirmation.** ✅ Confirmed — spin up the second Railway Postgres for this work.

`Q2.` **Dual-write timing.** ✅ v3 — dual-write lands in v3 against the dev DB so it's exercised before the v4 prod cutover.
