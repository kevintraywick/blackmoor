# Map Builder — Home Page Redesign + Session-Linked Naming

**Date:** 2026-04-06
**Branch:** `feat/map-builder`
**Type:** feat
**Origin:** User request in conversation (no `ce:brainstorm` doc — direct to plan)

## Problem

The Map Builder home page (`/dm/map-builder`) currently shows a single `+ New Map` card that always creates a blank named hex grid. The DM wants to start a map from a real image (file picker or drag-and-drop), and wants existing maps grouped and labeled by session — e.g. `S3 — Red Room` — so the home page reads like a session index, not an unsorted pile.

## Goals

1. Three creation paths on row 1, each producing a map build with a clear initial state.
2. Maps display as `S{n} — {name}` when linked to a session, with session-grouped layout.
3. Existing builds (no session) are not lost — they live in row 2 as "Unassigned".

## Non-Goals

- Mappy AI / image analysis (still parked on the post-API-key todo).
- Changing the editor view itself.
- Touching the existing in-editor session-link panel — that still works for linking after creation.
- Any change to the player-facing `/maps/[id]` viewer.

## Spec

### Row 1 — three creation cards (left → right)

| Card | Behavior |
|---|---|
| **`[+ New Map]`** (file picker) | Click → OS file dialog → user selects PNG/JPEG/WEBP → upload to existing `/api/map-builder/[id]/image` after creating the build → image dropped onto a fresh build's first level (default 30×30m, current behavior when Mappy is absent) → editor opens. |
| **`(+ Drop Map)`** (image drop circle) | A circular drop zone styled after the Journey/Journal banner circles. Dragging an image onto it does the same upload + open flow as `[+ New Map]`. Visual: dashed border on hover, green border + scale on drag-over. |
| **`[+ Blank Map]`** | Current `+ New Map` behavior verbatim — prompts for a name, creates a build with an empty `Level 1`, opens the editor. |

All three open the editor immediately after creation (existing `loadBuild` flow).

### Row 2 — Unassigned

Builds with `session_id IS NULL`. Section header "Unassigned" in muted gold-uppercase. Same 200×200 cards as today.

### Rows 3+ — Session-grouped, ascending

Builds grouped by session, ordered by session number ascending. Each group has a header `Session {n} — {title}` and the maps inside it are listed left to right. Card label format: `S{n} — {map name}` (e.g. `S3 — Red Room`). The session selector for assigning lives inside the card or via double-click — see decision below.

### Session linking — optional

A new optional `session_id` column on `map_builds`. Set:
- At creation time via the editor's existing session-link panel (no UI change there).
- From the home page card itself: a small `· · ·` or pencil affordance reveals an inline session picker (button group, not a dropdown — per `DESIGN.md`). For first cut: keep card click → loads editor; **do not add card-level session picker yet**. The editor's existing link panel is enough to set/clear `session_id`.

When the editor's link panel currently writes to the `maps` table (frozen copy), it should *also* set `map_builds.session_id` so the home page reflects the link.

## Open Decisions

1. **Card label when no session linked yet:** show just the map name (e.g. `Red Room`). This is consistent with falling under the "Unassigned" header.
2. **Multiple maps per session:** allowed. Sort within a session group by `updated_at DESC` (most recently touched first within a session).
3. **What happens to the existing `[id]/link` route?** It continues to work. The change: it must update `map_builds.session_id` in addition to the frozen-copy insert into `maps`. If a build is re-linked to a different session, update in place (don't keep the old link).

## Files

### Schema
- **`lib/schema.ts`** — add column:
  ```sql
  ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS session_id TEXT
    REFERENCES sessions(id) ON DELETE SET NULL;
  ```
  Use the same `.catch(() => {})` pattern as other ALTERs. Add an index on `session_id`.

### Types
- **`lib/types.ts`** — add `session_id: string | null` to `MapBuild`.

### API
- **`app/api/map-builder/route.ts`** —
  - `GET`: also `LEFT JOIN sessions s ON s.id = map_builds.session_id` so each row carries `session_number` and `session_title`. Order: `session_number NULLS FIRST, updated_at DESC`.
- **`app/api/map-builder/[id]/route.ts`** — `PATCH` accepts `session_id` (string or null) and updates the column.
- **`app/api/map-builder/[id]/link/route.ts`** — after the existing frozen-copy insert, also `UPDATE map_builds SET session_id = $1 WHERE id = $2`.
- **`app/api/map-builder/route.ts`** — `POST` extends to optionally accept `session_id` and write it on create (so the file-picker / drop flow can pre-link if desired in future; for first cut, callers may omit).

### UI
- **`components/MapBuilderClient.tsx`** — refactor the home view (`if (!activeBuildId)` block):
  - Replace single new-map card with a 3-card row 1: `New Map (file picker)`, `Drop Map (circle)`, `Blank Map`.
  - File picker: hidden `<input type="file" accept="image/png,image/jpeg,image/webp">` triggered by ref.
  - Drop circle: `onDragOver` / `onDragLeave` / `onDrop` — same `handleImageFile` helper as the file picker uses.
  - Shared helper `createBuildFromImage(file, name?)`:
    1. `POST /api/map-builder` with `name = file.name without extension`
    2. `POST /api/map-builder/{newId}/image` with the file
    3. Update local `builds` list
    4. `loadBuild(newId)`
  - Existing inline blank-name dialog stays under the `[+ Blank Map]` card.
  - Group existing builds by `session_id`:
    - Pull `unassigned = builds.filter(b => !b.session_id)` → render below row 1 under "Unassigned" header.
    - `bySession = groupBy(builds.filter(b => b.session_id), b => b.session_number)` → ordered ascending → each group rendered with its header and cards.
  - Card label: `S{n} — {map name}` when assigned, plain `{map name}` when unassigned.
- **No new components.** Keep this in `MapBuilderClient.tsx` for now — it's all contained in the home view branch.

### Patterns to follow
- Drop circle styling: mirror the Journey campaign circle and Journal circle (`components/JourneyClient.tsx`, `components/DmJournalClient.tsx`) — black border, scale + green border on drag-over, inline styles for sizing (Tailwind v4 + Safari gotcha).
- File-upload helper pattern: `FormData` + `fetch('/api/map-builder/{id}/image', { method: 'POST', body: fd })`, mirroring the existing in-editor image-drop flow in `MapBuilderClient.tsx`.
- Cards: keep current 200×200 size, dashed border for empty/new, solid for existing.
- Section headers: `text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]` — match the existing "Hex Grid Editor" subtitle.

## Verification

- Navigate to `/dm/map-builder` after restart: row 1 shows three cards (New Map, Drop Map circle, Blank Map). Existing maps appear under "Unassigned" since none have a session yet.
- Click `[+ Blank Map]` → name dialog appears → enter name → editor opens with empty Level 1. (Regression check: current behavior preserved.)
- Click `[+ New Map]` → file dialog → pick a PNG → editor opens with image overlay loaded (default 30×30m).
- Drag a PNG onto `(+ Drop Map)` circle → editor opens with image overlay loaded. Visual: green border + slight scale on drag-over.
- Use the in-editor session-link panel to link a build to S3 → return to home → that build appears under "Session 3 — {title}" with card label `S3 — {name}`. Removed from Unassigned.
- Re-link to S2 → moves to "Session 2" group; old S3 group is gone if empty.
- Multiple maps in one session sort by `updated_at DESC` within the group.
- Existing test build (`Test Map`) created earlier this session shows under "Unassigned".

## Risks & Mitigations

- **`ensureSchema` memoization** — adding `ALTER TABLE` requires a server restart.
  - *Mitigation:* Kill port 3000 + `npx next dev -p 3000` immediately after the schema edit, BEFORE writing/testing any code that touches `session_id`. Verify with `curl /api/map-builder` returns 200 and rows include `session_id: null`. Wrap the ALTER in `.catch(() => {})` so re-runs are harmless. Railway restarts on `railway up` deploy.

- **`[id]/link` regression** — that route inserts a frozen copy into `maps`. Adding a `map_builds.session_id` update must not break that.
  - *Mitigation:* Wrap both writes in `BEGIN/COMMIT` transaction (small upgrade — current route is plain). Order: insert into `maps` first (high-value side effect), then update `map_builds`. Test before AND after the change: link → confirm `maps` row + `map_builds.session_id` populated; re-link to a different session → confirm column updates in place.

- **`GET /api/map-builder` ordering change** — switching from `updated_at DESC` to `session_number NULLS FIRST, updated_at DESC` changes the API contract.
  - *Mitigation:* Confirmed only one consumer (`MapBuilderClient.tsx`) via grep. That client re-groups the data anyway. No regression risk.

- **Filename as initial map name** is ugly (`IMG_4421.png`).
  - *Mitigation:* Strip extension before using as name (`IMG_4421`). DM can double-click rename on the card (existing affordance). No prompt-first dialog — speed > prettiness for first cut.

- **Cross-codebase type propagation** — adding `session_id` to `MapBuild` may break other type-checking sites.
  - *Mitigation:* Run `tsc --noEmit` before declaring Unit 1 done (per `feedback_tsc_before_deploy.md`).

## Implementation Units

### Unit 1 — Schema + types + API surface
**Files:** `lib/schema.ts`, `lib/types.ts`, `app/api/map-builder/route.ts`, `app/api/map-builder/[id]/route.ts`, `app/api/map-builder/[id]/link/route.ts`

- Add `session_id` column + index to `map_builds`.
- Extend `MapBuild` type with `session_id`, `session_number?`, `session_title?`.
- Update `GET /api/map-builder` to JOIN sessions and project number/title.
- Update `PATCH /api/map-builder/[id]` to accept `session_id`.
- Update `[id]/link` to also `UPDATE map_builds SET session_id`.

**Verification:** restart server, hit `GET /api/map-builder` → rows include `session_number` (null for existing). Manually `PATCH` a row with a session id → reflected in subsequent GET.

### Unit 2 — Three-card row 1 (Blank, File, Drop)
**Files:** `components/MapBuilderClient.tsx`

- Refactor the `if (!activeBuildId)` block:
  - Add `[+ Blank Map]` (current behavior, just relabeled).
  - Add `[+ New Map]` with hidden file input + ref → on change, run `createBuildFromImage(file)`.
  - Add `(+ Drop Map)` circle with drag handlers → same helper.
- Implement `createBuildFromImage(file)`:
  1. POST `/api/map-builder` with name derived from file basename.
  2. POST `/api/map-builder/{id}/image` with `FormData`.
  3. Append to `builds`, call `loadBuild`.

**Verification:** all three cards open the editor; file/drop variants land with image overlay loaded.

### Unit 3 — Session grouping on the home view
**Files:** `components/MapBuilderClient.tsx`

- Compute `unassigned` and `bySession` from `builds`.
- Render row 2 as `Unassigned` group; rows 3+ as one group per session in ascending session-number order.
- Card labels: `S{n} — {name}` when assigned, plain `{name}` otherwise.
- Sort within a session group by `updated_at DESC`.

**Verification:** linking a build via the editor's session-link panel moves it to the correct group on return to home; unlinking returns it to Unassigned.

## Out of Scope (deferred)

- Card-level session picker (set/change session without entering the editor). The editor's existing panel covers it for now.
- Mappy AI for real dimension extraction.
- Reordering session groups by drag, multi-select, or bulk actions.
