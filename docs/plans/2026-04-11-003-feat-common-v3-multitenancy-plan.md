# Common v7 — Multi-Tenancy Refactor

**Date:** 2026-04-11 (reviewed + renumbered 2026-04-18)
**Status:** ready (depends on v3 H3 substrate and v6 `dms` table shipping first)
**Owner:** Kevin (@kevin / @thewolf)
**Estimate:** 1.5–2 weeks focused work

> **Renumbering note (2026-04-18):** This plan was written when this work was called "Common v3." The ladder has since been restructured; this is now **v7 (Campaign scoping)** followed by **v8 (Cutover — `campaign_id` NOT NULL)**. Internal references in this doc have been updated in-place; older git history may still say "v3/v4."

## Goal

Remove the single-campaign singleton assumption. Introduce a real `campaigns` table. Fan `campaign_id` out across every scoped table. Keep Shadow of the Wolf functioning throughout.

**End state of v7:** the refactor is complete in code, but URLs are unchanged and the old singleton `campaign` table has not been dropped yet. That "flip day" is **v8**, deliberately separated so the risky cutover is its own ship moment.

## Non-goals

- No URL changes (those are v8).
- No dropping of the old singleton (v8).
- No Common World tables, hexes, or entities (v9+).
- No public signup (v21 closed beta / v22 public launch). Login is deferred entirely to v21.
- **No pocket mode.** Every campaign is CW canon. DMs who want private homebrew worlds are better served by existing tools (2026-04-18 decision).

## Prerequisites (must land before v7 starts)

- **v3 — H3 spatial substrate.** `world_hexes` already keyed on H3 cell IDs by the time v7 touches it. The ladder was reordered 2026-04-18 so H3 lands before multi-tenancy.
- **v6 — `dms` table.** The `campaigns.dm_id` FK (line ~68) depends on this table existing. Confirm the first v6 item creates it.
- **v2 — Common World versions page.** Already shipped.

## The key decision — dev DB path

Kevin reconsidered his earlier "no dev DB" stance. **v7 uses a dedicated dev DB on Railway.** The earlier strangler-fig plan was gymnastics to avoid the $5/mo of a separate Postgres service, at a cost of ~25% more refactor work and two-code-path maintenance. Not worth it.

### Dev DB setup (part of v7 prep)

1. Create a second Postgres service on Railway, in the same project. Name it `blackmoor-dev-db`.
2. Copy the `DATABASE_PUBLIC_URL` from the new service.
3. In the `~/blackmoor-common` worktree, create `.env.local` with that URL.
4. Seed the dev DB from a recent production backup (commit 4fa370f's nightly backup is exactly this — grab the latest artifact).
5. Verify the dev DB loads and the Shadow data is present in the dev environment.

The production DB is **never** touched during v7 development. Only on merge day (which is v8's responsibility) does the refactor hit production.

## Worktree + branch setup

From the existing `~/blackmoor` folder (main, Shadow production):

```
git status                                   # must be clean
git worktree add ../blackmoor-common -b feat/common
cd ../blackmoor-common
npm install                                   # separate node_modules
# create .env.local pointing at dev DB
```

From now until v8, all Common v7 work happens in `~/blackmoor-common`. Shadow maintenance continues in `~/blackmoor`. Both folders serve their own dev server (ports 3000 and 3001).

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
  -- per-campaign game clock moves here from the singleton campaign row.
  -- note: v9 adds a separate world-level Common Year clock (§5 of BRAINSTORM.md).
  -- these two are not the same thing — this one is each DM's table-time.
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
- `world_hexes` *(already H3-keyed from v3; now also `campaign_id`-scoped as Shadow's view of the world)*
- `world_entities`

**Note on world vs Common World layering (v9+ forward-dependency).** In v7, every `world_*` row represents *that campaign's* slice of the world — still single-tenant behavior, just correctly scoped. In v9, parallel `common_world_*` tables land that are **tenant-less** (hexes, storms, voids, armies shared across all campaigns). Per-campaign `world_*` remains for campaign-private state. v7 doesn't need to build the split — it just needs to scope the existing tables cleanly so v9 can layer on top without a second migration.

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
// In v7, there's exactly one campaign (shadow), so this returns that
// campaign's id for every caller. In v8, it starts reading from the URL
// slug ([campaignSlug] route segment).
export async function getCampaignId(): Promise<string>
```

Every `lib/*.ts` helper that writes to a scoped table gains a `campaignId` parameter. Every API route passes `await getCampaignId()` through. The migration of helpers is the bulk of the v7 work. Per the 2026-04-17 Q1 decision, tenancy is threaded **explicitly** — no AsyncLocalStorage / no implicit per-request context.

## Route changes during v7

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
12. **Consistency check.** Write a script that scans every scoped table and asserts `COUNT(*) WHERE campaign_id IS NULL = 0`. Run it daily during v7 development.
13. **Update `lib/game-clock.ts` dual-write.** The old `campaign` singleton and the new `campaigns.shadow` row stay in sync for game_time_seconds, clock_paused, clock_last_advanced_at. This is the only place the dual-write matters.
14. **Run full smoke test in dev DB.** Everything Kevin does in Shadow on Wednesday night should work end-to-end against the dev DB. Player sheets, session advance, long rest, map operations, raven post.
15. **Write v8 plan doc.** Before closing v7, the v8 flip plan must exist and be reviewable.

## Verification

- Every scoped table has a fully-populated `campaign_id` column in the dev DB.
- `grep -n "FROM campaign\b" lib/ app/` returns only the `lib/game-clock.ts` dual-write site.
- `npm run lint` clean.
- `npx tsc --noEmit 2>&1 | grep -v ".next/types"` clean.
- `npm run build` succeeds against the dev DB.
- Kevin can run a full mock session from `/dm` → `/dm/initiative` → `/dm/players/ashton` without any visible difference from main.
- The consistency check script reports zero NULL `campaign_id` rows.

## Rollback

v7 changes are all additive at the schema level. To roll back:

1. Discard the `feat/common` branch (or archive it).
2. Drop the new tables and columns on the dev DB, or destroy the dev DB entirely.
3. Main is untouched. Production is untouched. Shadow keeps running.

The dev DB's disposability is the single biggest safety margin v3 has.

## What v8 inherits

When v7 ships, v8 has:
- A complete set of `campaign_id`-aware helpers and routes.
- A `campaigns` table with the shadow row populated.
- Every scoped DB row tagged with the shadow campaign_id.
- No changes to the old singleton `campaign` row (still there).

v8 flips `campaign_id` to NOT NULL, restructures routes to `/dm/[slug]/*`, drops the old singleton. That's the cutover day, done against production for the first time. It's a small, clearly-bounded PR — the dangerous work is all in v7, the one-shot flip is in v8.

## Open questions

Resolved 2026-04-16:

`Q1.` **Dev DB confirmation.** ✅ Confirmed — spin up the second Railway Postgres for this work.

`Q2.` **Dual-write timing.** ✅ v7 — dual-write lands in v7 against the dev DB so it's exercised before the v8 prod cutover.

Resolved 2026-04-18:

`Q3.` **Pocket mode.** ✅ Dropped. Every campaign is CW canon; no opt-out flag.

`Q4.` **Tenant context threading.** ✅ Explicit `campaignId` parameter on every scoped helper. No AsyncLocalStorage, no implicit context.

`Q5.` **Strangler vs dual-write.** ✅ Dual-write (additive columns, both-rows stay consistent, NOT NULL flip in v8). Not strangler.
