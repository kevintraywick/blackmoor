---
title: "feat: DM player change notifications"
type: feat
status: active
date: 2026-04-02
---

# feat: DM player change notifications

## Overview

When players edit their character sheets, the DM should see a red dot on the nav bar indicating unread changes. Clicking the dot reveals an inline slide-down panel (same pattern as DM messages on player sheets) with a grouped summary of what each player changed.

## Problem Frame

The DM has no visibility into player-initiated edits between sessions. Players update HP, gold, gear, spells, notes, etc. via autosave, and the DM only discovers these changes by manually checking each sheet. A lightweight notification solves this without adding complexity.

## Requirements Trace

- R1. Log player-initiated edits (not DM-only fields like `dm_notes`, `status`) to a `player_changes` table
- R2. Show a red dot on the right end of the DM nav bar when unread changes exist
- R3. Clicking the dot toggles an inline slide-down panel with change summaries grouped by player
- R4. Mark changes as read when the DM opens the panel
- R5. Human-readable summaries: scalar fields show old/new values, JSON fields show "modified gear/spells/items"

## Scope Boundaries

- No cron job or scheduler — changes are logged in real-time as they happen
- No AI summarization — deterministic formatting only
- No change history beyond unread/read — old read changes can accumulate (cleanup is a future concern)
- DM-only fields (`dm_notes`, `status`) are excluded from logging
- Character name changes (`PATCH /api/players/[id]/name`) are excluded for now (can be added later)

## Context & Research

### Relevant Code and Patterns

- **DM messages red dot** (`components/PlayerSheet.tsx:387-600`): Exact UX pattern to follow — `showMessages` state, `toggleMessages()` that fetches + marks read, slide-down panel with `maxHeight` transition, `dm_message.png` background with dark overlay
- **DM nav bar** (`components/DmNav.tsx`): Sticky green bar, already accepts `poisonCount` prop for pulse indicator. Will add `changeCount` prop and red dot at right end
- **Player PATCH route** (`app/api/players/[id]/route.ts`): Single endpoint for all player field updates. Upserts then updates. This is where change logging will be inserted — SELECT old values before UPDATE, then INSERT diffs into `player_changes`
- **DM messages table/API** (`lib/schema.ts`, `app/api/dm-messages/`): Schema pattern (TEXT PK, BIGINT timestamps, `read` boolean), mark-as-read endpoint pattern
- **Session events table** (`lib/schema.ts`): JSONB payload pattern for flexible event data
- **`useAutosave` hook** (`lib/useAutosave.ts`): Debounced 600ms, batches multiple field patches into single PATCH call — means one PATCH may contain multiple changed fields

### DM Nav Usage

`DmNav` is rendered from ~14 server component pages under `app/dm/`. Each will need to pass `changeCount`. The simplest approach: DmNav fetches its own count client-side (like it already does for `poisonCount` when not provided as a prop), avoiding changes to every DM page.

## Key Technical Decisions

- **Client-side count fetch in DmNav**: Rather than threading `changeCount` through all 14 DM pages, DmNav will fetch `/api/player-changes?count=true` on mount (same pattern as the existing poison count fallback fetch on line 37). This keeps the change self-contained.
- **Old value capture**: Before the UPDATE in the PATCH route, SELECT the current row to capture old values. Compare old vs new for each patched field and only log actual changes (skip if old === new).
- **Change row granularity**: One row per changed field per PATCH call. A PATCH that changes both HP and gold creates 2 rows. This makes the summary query simple (GROUP BY player_id, field).
- **Slide-down panel lives in DmNav**: The panel component is co-located with the dot in DmNav since DmNav is already a client component. Panel uses the same transition pattern as PlayerSheet messages.
- **Exclude DM fields**: The `dm_notes` and `status` fields are DM-edited. Hard-code exclusion in the PATCH route logging logic.
- **Summary formatting**: Scalar fields → "HP: 45 → 32". JSON fields (gear, spells, items) → "Modified gear" (diffing JSON arrays is complex and low-value for a notification).

## Implementation Units

- [ ] **Unit 1: Database table + types**

  **Goal:** Create `player_changes` table and TypeScript type

  **Requirements:** R1

  **Dependencies:** None

  **Files:**
  - Modify: `lib/schema.ts`
  - Modify: `lib/types.ts`

  **Approach:**
  - Add `player_changes` table in `_initSchema()`: `id TEXT PK DEFAULT gen_random_uuid()::text`, `player_id TEXT NOT NULL`, `field TEXT NOT NULL`, `old_value TEXT`, `new_value TEXT`, `created_at BIGINT DEFAULT epoch`, `read BOOLEAN DEFAULT false`
  - Index on `(read, created_at DESC)` for the unread query
  - Add `PlayerChange` interface to `types.ts`

  **Patterns to follow:**
  - `dm_messages` table definition in `schema.ts` (lines 372-380)
  - `DmMessage` interface in `types.ts`

  **Verification:**
  - Dev server restarts without error
  - Table created in DB (check via `psql` or API)

- [ ] **Unit 2: Log changes in player PATCH route**

  **Goal:** Intercept player edits and write change records

  **Requirements:** R1, R5

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `app/api/players/[id]/route.ts`

  **Approach:**
  - Before the UPDATE, SELECT current row values for the patched fields
  - After UPDATE, compare old vs new for each field. Skip if values are equal. Skip `dm_notes` and `status`
  - INSERT one `player_changes` row per actually-changed field
  - For JSON columns (gear, spells, items), compare stringified values
  - Use a single multi-row INSERT when multiple fields changed
  - Wrap change logging in `.catch(() => {})` so it never breaks the existing save flow

  **Patterns to follow:**
  - Existing PATCH handler structure in `app/api/players/[id]/route.ts`
  - DM messages POST in `app/api/dm-messages/route.ts` for INSERT pattern

  **Test scenarios:**
  - Player changes HP: one row logged with old/new values
  - Player changes HP and gold in same patch: two rows logged
  - DM changes dm_notes: no row logged
  - Player saves same value (no actual change): no row logged

  **Verification:**
  - Edit a player field on the player sheet, check `player_changes` table has a row

- [ ] **Unit 3: API endpoints for change notifications**

  **Goal:** GET unread changes (with optional count-only mode) and PATCH to mark as read

  **Requirements:** R3, R4

  **Dependencies:** Unit 1

  **Files:**
  - Create: `app/api/player-changes/route.ts`
  - Create: `app/api/player-changes/read/route.ts`

  **Approach:**
  - `GET /api/player-changes` — returns all unread changes ordered by created_at DESC. If `?count=true` query param, return just `{ count: N }`
  - `PATCH /api/player-changes/read` — sets `read = true` on all unread rows, returns `{ ok: true }`
  - Both call `ensureSchema()` at top

  **Patterns to follow:**
  - `app/api/dm-messages/route.ts` (GET)
  - `app/api/dm-messages/read/route.ts` (PATCH mark-as-read)

  **Verification:**
  - `GET /api/player-changes` returns logged changes
  - `GET /api/player-changes?count=true` returns `{ count: N }`
  - `PATCH /api/player-changes/read` clears unread state

- [ ] **Unit 4: Red dot + slide-down panel in DmNav**

  **Goal:** Show red dot at right end of DM nav bar; clicking toggles a change summary panel

  **Requirements:** R2, R3, R4, R5

  **Dependencies:** Unit 3

  **Files:**
  - Modify: `components/DmNav.tsx`

  **Approach:**
  - Add state: `changeCount` (fetched on mount via `/api/player-changes?count=true`), `showChanges`, `changes` array, `loadingChanges`
  - Red dot: 16px `#dc2626` circle, `animate-pulse`, positioned at the right end of the nav bar (after the links flex container). Only shows when `changeCount > 0`
  - Stale dot: when `changeCount === 0`, show muted 12px dot at 40% opacity (same as player message stale dot) so DM can re-open history
  - `toggleChanges()`: if opening, fetch `/api/player-changes` for full data + call `/api/player-changes/read` to mark read + set `changeCount` to 0. If closing, just hide panel
  - Panel: slide-down below nav using `maxHeight` transition (same as PlayerSheet messages). Dark background with `rgba(26,22,20,0.95)` overlay. Red header "Player Changes" in uppercase sans
  - Group changes by `player_id`, then list fields: scalar → "HP: 45 → 32", JSON → "Modified gear"
  - Player names: fetch from `/api/players` or use the `player_id` directly (player IDs are readable names like "ashton", "brandon")
  - Close button (✕) top-right

  **Patterns to follow:**
  - PlayerSheet message dot rendering (lines 541-547 for mobile, 370-377 for desktop)
  - PlayerSheet message panel slide-down (lines 575-620)
  - DmNav poison count fetch pattern (lines 35-38)

  **Test scenarios:**
  - No changes: no dot visible (or stale muted dot)
  - Unread changes: red pulsing dot appears
  - Click dot: panel slides down with grouped summaries
  - Click ✕: panel slides up
  - After reading: dot stops pulsing, count resets

  **Verification:**
  - Make a player edit, reload a DM page, see red dot
  - Click dot, see change summary panel with correct data
  - Panel closes on ✕, dot becomes muted

## Risks & Dependencies

- **ensureSchema memoization**: After adding the new table DDL, dev server must be restarted. Document in test instructions.
- **Autosave batching**: `useAutosave` batches fields at 600ms. A single PATCH may contain multiple fields — the logging must handle multi-field patches correctly.
- **Change volume**: Active sessions could generate many change rows. Future cleanup (delete read changes older than N days) is out of scope but noted.

## Deferred to Implementation

- Exact player name display in the panel (use player_id directly since IDs are human-readable, or do a lightweight lookup)
- Whether to group changes by timestamp proximity (e.g., batch all changes within 1 minute together) — start simple, one row per field
- Character name change tracking (separate endpoint, add later if wanted)
