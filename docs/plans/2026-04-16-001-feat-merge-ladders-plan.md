# Plan — Merge Shadow & Common ladders into one

Date: 2026-04-16
Status: ready for approval
Branch: to be determined (likely `feat/merge-ladders` or direct on `main` since /do is low-risk)

## Goal

Drop the two-ladder model (`shadow` + `common`) on `/do` and ROADMAP.md. Going forward there's one ladder. Shadow v1 & v2 are already archived as prose. Shadow v3 (maps) becomes **v3** in the unified ladder. Common World v4–v18 keep their current numbers. The `/do` page shows a single column in the left-column position (right column stays empty for now).

Confirmed decisions (from conversation 2026-04-16):
- **Q1** Shadow v3 → new `v3`, Common v4–v18 unchanged. No cascading renumber.
- **Q2** Unified list in the left column; right column stays reserved/empty.
- **Q3** Common World is the brand. Shadow of the Wolf is the first campaign on it. Single page header.
- **Q4** Rename archive summary from "Shipped — Shadow past releases" → "Shipped".

## Pre-migration check

1. `pg_dump` already runs nightly at 6 UTC. Current copy: today's artifact from GitHub Actions is sufficient.
2. Before running the migration, confirm the current row counts so we can verify after:

```sql
SELECT ladder, version, COUNT(*) FROM roadmap_items GROUP BY 1, 2 ORDER BY 1, 2;
```

Expected snapshot (as of 2026-04-16): shadow-v1 = 14, shadow-v2 = 5, shadow-v3 = 19, common-v4..v18 ≈ 73 rows.

## DB migration (prod Railway)

One-shot SQL. Delete the shipped/archived rows (they live in ROADMAP.md prose; /do already hides them via the `all-built` filter), promote shadow-v3 to common-v3, then relax the CHECK constraint.

```sql
BEGIN;

-- 1) Drop the archived v1/v2 rows. They are captured in ROADMAP.md's "Shipped" section.
DELETE FROM roadmap_items WHERE ladder = 'shadow' AND version IN (1, 2);

-- 2) Shadow v3 → common v3 (maps work joins the unified ladder).
UPDATE roadmap_items SET ladder = 'common' WHERE ladder = 'shadow' AND version = 3;

-- 3) Relax the CHECK so a future schema pass can drop the column entirely.
ALTER TABLE roadmap_items DROP CONSTRAINT IF EXISTS roadmap_items_ladder_check;
ALTER TABLE roadmap_items ADD CONSTRAINT roadmap_items_ladder_check CHECK (ladder = 'common');

COMMIT;
```

After this: every row has `ladder = 'common'`. The column stays (for backwards-compat with in-flight code) but is now single-valued.

## App code changes

Keep the `ladder` column on the way out — refactor code to stop branching on it, but leave the DB column so we can drop it cleanly in a separate v3-polish pass.

### `lib/roadmap.ts`
- Narrow `RoadmapRow.ladder` type to `'common'` (or drop it from `RoadmapRow` entirely).
- `addItem(ladder, version, title)` → `addItem(version, title)`. Hardcode `'common'` in the INSERT.
- `exportToMarkdown` → simplify. Only one ladder now, so the section header regex can be tightened to `### v(\d+)` only (kill the `shadow|common` branch).
- Drop `### Shadow v1` / `### Shadow v2` / `### Shadow v3` detection entirely.

### `lib/schema.ts`
- Update the CHECK constraint string to `CHECK (ladder = 'common')` to match migration.
- Add the DDL for the relaxed CHECK so fresh environments match prod.

### API routes
- `app/api/roadmap/add/route.ts` — drop `ladder` from request body. Default to `'common'`.
- `app/api/roadmap/remove/route.ts`, `toggle/route.ts` — these key off `id`; no change.

### `components/DoPageClient.tsx` (biggest refactor)
- Delete the `Ladder` / `Roadmap` split. Replace with a single `Record<string, RoadmapItem[]>`.
- Remove the second `<LadderColumn>`. Keep one.
- Drop the `do-columns` flex wrapper; render the column at the full content width of the main container (still `maxWidth: 1000` from `/do/page.tsx`, so the unified list occupies what was "the left column").
- Rename internal types: `ladderKey: 'shadow' | 'common'` → remove the param entirely.
- Header copy: replace "Shadow of the Wolf" + "Common World" titles with a single page-level "Common World Roadmap" heading in `app/do/page.tsx` (the LadderColumn internal title goes away).
- Accent color: keep gold `#c9a84c` (the old Common accent), drop the Shadow brown.

### `app/do/page.tsx`
- Replace `rowsToRoadmap` — return a single `Record<string, RoadmapItem[]>` keyed by `vN`.
- Pass a single `roadmap` prop to `DoPageClient`.
- Add a single heading above the list (was implicit in `LadderColumn` title).

### `scripts/sync-roadmap.mjs`
- Drop the `shadow|common` branch of the section-header regex; keep only `### v(\d+)`.
- `ladder` is always `'common'` now.
- Idempotency check still holds.

## ROADMAP.md changes

1. Drop `## Shadow of the Wolf` H2 and its quote/description.
2. Drop `## Common World` H2 and its quote/description.
3. One H2 at the top: `## Roadmap` (with a short descriptor quote — "The unified roadmap for Common World and the campaigns running on it. Shadow of the Wolf is the flagship campaign.").
4. Archive section header: `### Shipped` (was `### Shipped — Shadow past releases`). Prose body keeps the same two paragraphs.
5. `### Shadow v3 — maps` → `### v3 — maps`. All `<!-- shadow-v3 -->` tags become `<!-- common-v3 -->` (matching the DB migration).
6. Common sections (`### v4 — current` through `### v18 — ERC-20 token bridge`) stay unchanged.
7. Re-run sync after the migration to normalize any whitespace drift.

## UI verification (must pass before push)

1. `/do` loads without client-console errors.
2. Single column renders in the left third/half of the content area, right side empty.
3. "v3 — maps" shows at the top with 19 items (2 built, 17 planned).
4. "v4 — current" through "v18" render below v3 in order.
5. "Add item" placeholder reads "v3 feature name…" (first active version after the refactor).
6. Toggle, remove, and add all work against the DB (smoke-test one item in each version).
7. `ROADMAP.md` sync is idempotent — two runs produce the same file.
8. `npx tsc --noEmit | grep -v ".next/types"` is clean.
9. `npm run lint` is clean.

## Rollback

DB:
```sql
BEGIN;
ALTER TABLE roadmap_items DROP CONSTRAINT roadmap_items_ladder_check;
ALTER TABLE roadmap_items ADD CONSTRAINT roadmap_items_ladder_check CHECK (ladder IN ('shadow', 'common'));
UPDATE roadmap_items SET ladder = 'shadow' WHERE version = 3 AND ladder = 'common';
-- v1/v2 rows are gone; only restorable from the nightly pg_dump artifact.
COMMIT;
```

Code: `git revert` the merge commit.

## Deferred (explicit non-goals)

- Dropping the `ladder` column from the table — do this in a follow-up once we're sure nothing else reads it.
- Renaming the second LadderColumn's reserved space to host something new (e.g., velocity chart, shipped-per-month sparkline). Out of scope.
- Migrating `MEMORY.md` / `CLAUDE.md` / `AGENTS.md` references that mention "Common" vs "Shadow" as separate projects. Those stay for institutional memory; they are still accurate in describing past structure.

## Commit boundary

Single commit, single PR-style change on `main`:

```
refactor(roadmap): merge Shadow + Common ladders; Shadow v3 → v3

- DB: drop archived shadow-v1/v2 rows, promote shadow-v3 to common-v3,
  relax CHECK to allow only 'common'.
- /do: drop the two-column split; single column in the left position.
- ROADMAP.md: single "Roadmap" section, "Shipped" archive kept as prose.
- Sync script + lib simplified (one ladder).
```

## Open question for implementer

The `ladder` column stays in the DB for one release cycle. If there's never a reason to re-introduce a second ladder by the time Common v6 (multi-tenancy) lands, drop the column as part of that migration. Tag this as shadow-deferred in a v3 item.
