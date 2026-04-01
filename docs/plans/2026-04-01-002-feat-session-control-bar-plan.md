---
title: "feat: DM Session Control Bar — lifecycle buttons, event logging, omnibus Long Rest"
type: feat
status: active
date: 2026-04-01
---

# feat: DM Session Control Bar

## Overview

Add a row of 5 control circles to the Sessions page (between session boxes and content panes) that give the DM quick session lifecycle controls: Start, Long Rest, Roll Initiative, Boon, and End. Session events are logged to a new `session_events` table for future recap/timeline features. Long Rest is an omnibus action that restores NPC HP, expires long-rest boons, clears long-rest poisons, and clears short-rest effects.

## Problem Frame

The DM currently manages session lifecycle (starting, ending, long rests, combat) by navigating to separate pages and clicking individual buttons. There's no single place to control the session flow, and no persistent log of what happened during a session (combat count, damage taken, NPCs killed, etc.).

## Requirements Trace

- R1. 5 circle buttons between session boxes and content: START, LONG REST, ROLL INITIATIVE, BOON, END
- R2. Circles are 64px, transparent with thin gold border, white text (same as NPC circles)
- R3. START: slow green pulse when active. END: slow red pulse when active. END resets START.
- R4. LONG REST: omnibus action — restore NPC HP, expire long-rest boons, clear long-rest poisons, clear short-rest effects. Logs event.
- R5. ROLL INITIATIVE: navigates to `/dm/initiative`. Logs combat start event. Tracks combat count per session.
- R6. BOON: navigates to `/dm/boons`. Remind user to add "Return to Session" button there.
- R7. Session events stored in `session_events` table: session_id, event_type, payload JSONB, timestamp
- R8. Add "Return to Session" button on Initiative and Boons pages
- R9. Log events: session_start, session_end, long_rest, combat_start, player_damaged, player_poisoned, boon_granted, npc_killed

## Scope Boundaries

- No real-time session broadcasting (SSE) — session state is per-DM-browser via localStorage + DB
- No session recap/timeline UI in v1 — just the data model and event writes
- Player damage/poison/boon/NPC-killed logging is deferred to later units — v1 logs start/end/long_rest/combat_start
- Short rest as a separate button is not in v1 — Long Rest covers both

## Context & Research

### Relevant Code and Patterns

- `components/DmSessionsClient.tsx` — where the control bar will be inserted (between session boxes and content)
- `handleLongRest` — current NPC-HP-only implementation to extend
- `app/dm/initiative/page.tsx` + `InitiativePageClient.tsx` — Roll Initiative target
- `app/dm/boons/page.tsx` + `BoonsDmClient.tsx` — Boon target
- `app/api/boons/route.ts` — PATCH with `action: 'cancel'` pattern for expiring boons
- `app/api/poison/route.ts` — needs research for clearing long-rest poisons
- `lib/useAutosave.ts` — debounced save pattern
- `localStorage` key `blackmoor-last-session` — cross-page session ID signal

### Institutional Learnings

- `ensureSchema` memoized — restart dev server after DDL
- Tailwind v4 grid/gap issues — use inline styles
- Safari flex issues — use inline gap
- Commit immediately after working changes to prevent linter reverts

## Key Technical Decisions

- **`session_events` table**: `id TEXT PK, session_id TEXT FK, event_type TEXT, payload JSONB, created_at BIGINT`. Indexed on `session_id`. Supports future querying for session recaps.
- **Session lifecycle in DB**: Add `started_at BIGINT` and `ended_at BIGINT` columns to `sessions` table. START sets `started_at`, END sets `ended_at`. Allows querying active/past sessions.
- **Omnibus Long Rest API**: New `POST /api/sessions/:id/long-rest` endpoint that atomically: restores menagerie HP, expires long-rest boons for all players, clears long-rest poisons, logs the event. Single API call from the button.
- **Combat count**: Query `session_events` table for `event_type = 'combat_start'` where `session_id` matches. No separate counter column needed.
- **Control bar placement**: Rendered inside `DmSessionsClient` between the session box row and the content grid. Centered horizontally. Only visible when a session is selected.
- **Return to Session**: Use `localStorage` key `blackmoor-last-session` to build the return URL. A simple Link to `/dm` (sessions page auto-selects the last session on load).

## Open Questions

### Resolved During Planning

- **Where does session_start/end state live?** In the `sessions` table via `started_at`/`ended_at` columns, plus event log rows.
- **How does Roll Initiative know which session?** `localStorage` key `blackmoor-last-session` — already used by InitiativePageClient.
- **What clears on short rest?** Same as long rest minus boon expiry (boons specify their own expiry type). For v1, Long Rest covers both — a separate Short Rest button can be added later.

### Deferred to Implementation

- Exact poison API for clearing long-rest poisons (need to check poison table schema for `duration` field)
- Animation CSS for slow pulse (green/red) — may use `@keyframes` or Tailwind `animate-pulse` with color override
- Whether `started_at`/`ended_at` should prevent double-start or allow restart

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
Session Control Bar State Machine:

  [No session selected] → bar hidden

  [Session selected, not started] → START(inactive) | LONG REST | ROLL INIT | BOON | END(inactive)
                                      ↓ click
  [Session active] → START(green pulse) | LONG REST | ROLL INIT | BOON | END(inactive)
                                                                           ↓ click
  [Session ended] → START(inactive) | LONG REST | ROLL INIT | BOON | END(red pulse)
```

```
Omnibus Long Rest Flow:
  POST /api/sessions/:id/long-rest
    → UPDATE menagerie: hp = maxHp for all entries
    → UPDATE player_boons: active = false WHERE expiry_type IN ('long_rest', 'short_rest') AND active = true
    → UPDATE poison_status: active = false WHERE duration = 'long_rest' AND active = true
    → INSERT session_events: { session_id, event_type: 'long_rest', payload: { restored_npcs, expired_boons, cleared_poisons } }
    → RETURN summary
```

## Implementation Units

### Phase 1: Data Model

- [ ] **Unit 1: session_events table + session lifecycle columns**

  **Goal:** Create the event log table and add start/end timestamps to sessions.

  **Requirements:** R7, R3

  **Dependencies:** None

  **Files:**
  - Modify: `lib/schema.ts`
  - Modify: `lib/types.ts`

  **Approach:**
  - `CREATE TABLE IF NOT EXISTS session_events (id TEXT PK DEFAULT gen_random_uuid(), session_id TEXT NOT NULL, event_type TEXT NOT NULL, payload JSONB DEFAULT '{}', created_at BIGINT DEFAULT epoch)`
  - `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS started_at BIGINT`
  - `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ended_at BIGINT`
  - Add `SessionEvent` interface and update `Session` interface with `started_at?` and `ended_at?`

  **Patterns to follow:** Existing DDL in `lib/schema.ts` with `.catch(() => {})`

  **Verification:** Dev server restarts, tables exist, sessions have new nullable columns

### Phase 2: APIs

- [ ] **Unit 2: Session lifecycle API (start/end)**

  **Goal:** Endpoints to start and end a session, logging events.

  **Requirements:** R3, R7, R9

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `app/api/sessions/[id]/route.ts` (add POST actions for start/end)

  **Approach:**
  - Extend the existing session PATCH endpoint OR add a new POST action handler
  - `POST /api/sessions/:id` with `{ action: 'start' }` → sets `started_at`, inserts `session_start` event
  - `POST /api/sessions/:id` with `{ action: 'end' }` → sets `ended_at`, inserts `session_end` event
  - Return the updated session

  **Patterns to follow:** `app/api/boons/route.ts` PATCH action pattern

  **Verification:** Start sets timestamp, end sets timestamp, events logged

- [ ] **Unit 3: Omnibus Long Rest API**

  **Goal:** Single endpoint that restores NPC HP, expires boons, clears poisons, logs event.

  **Requirements:** R4, R7, R9

  **Dependencies:** Unit 1

  **Files:**
  - Create: `app/api/sessions/[id]/long-rest/route.ts`

  **Approach:**
  - POST handler: receives session ID from URL
  - Restore menagerie HP: read session.menagerie, set each entry's hp = maxHp, update
  - Expire long-rest boons: `UPDATE player_boons SET active = false WHERE active = true AND expiry_type IN ('long_rest')`
  - Clear long-rest poisons: `UPDATE poison_status SET active = false WHERE active = true AND duration = 'long_rest'`
  - Log event with summary payload (count of restored NPCs, expired boons, cleared poisons)
  - Return summary for UI feedback

  **Patterns to follow:** Existing `handleLongRest` logic, `app/api/boons/route.ts` cancel pattern

  **Verification:** All three systems reset, event logged, response includes counts

- [ ] **Unit 4: Session events API (log + query)**

  **Goal:** Generic endpoint to log events and query combat count.

  **Requirements:** R5, R7, R9

  **Dependencies:** Unit 1

  **Files:**
  - Create: `app/api/sessions/[id]/events/route.ts`

  **Approach:**
  - POST: insert event `{ event_type, payload }` for the session
  - GET: return events for the session (optionally filtered by type via query param)
  - Combat count: GET with `?type=combat_start` returns array, client counts `.length`

  **Verification:** Events insert and query correctly

### Phase 3: UI

- [ ] **Unit 5: Session Control Bar component**

  **Goal:** 5 circle buttons rendered between session boxes and content in DmSessionsClient.

  **Requirements:** R1, R2, R3, R5, R6

  **Dependencies:** Units 2, 3, 4

  **Files:**
  - Modify: `components/DmSessionsClient.tsx`

  **Approach:**
  - New internal component `SessionControlBar` with props: `sessionId`, `session` (for started_at/ended_at)
  - 5 circles in a centered flex row, 64px each, inline styles for sizing (Tailwind v4 compat)
  - Default: transparent bg, `1px solid rgba(201,168,76,0.5)` border, white text
  - START: on click → POST start action, green pulse via CSS animation
  - LONG REST: on click → POST to long-rest API, show brief confirmation
  - ROLL INITIATIVE: Link to `/dm/initiative`, also POST combat_start event
  - BOON: Link to `/dm/boons`
  - END: on click → POST end action, red pulse, reset START state
  - Fetch session events on mount to determine active state and combat count
  - Show combat count badge on Roll Initiative circle if > 0

  **Patterns to follow:**
  - Dice button styling from InitiativePageClient (transparent circle, gold border)
  - NPC circle sizing from DmSessionsClient (64px inline)

  **Verification:**
  - Bar visible when session selected, hidden when not
  - START/END toggle correctly with pulses
  - Long Rest triggers omnibus action
  - Roll Initiative navigates and logs
  - Boon navigates

- [ ] **Unit 6: Return to Session buttons**

  **Goal:** Add "Return to Session" navigation on Initiative and Boons pages.

  **Requirements:** R8

  **Dependencies:** None (can be done in parallel)

  **Files:**
  - Modify: `components/InitiativePageClient.tsx`
  - Modify: `components/BoonsDmClient.tsx`

  **Approach:**
  - On both pages, add a circle or link button that navigates to `/dm` (the sessions page)
  - Use the dice_home button style (small circle) or a simple text link
  - Position: near the top of the page, alongside existing controls
  - The sessions page auto-selects the last session via localStorage, so a simple Link to `/dm` suffices

  **Patterns to follow:** dice_home button pattern from CYP page, DmNav home circle

  **Verification:** Clicking returns to sessions page with the correct session selected

## System-Wide Impact

- **Boons system:** Long Rest will expire active long-rest boons. The `player_boons` table already has `expiry_type` and `active` columns. Players will see their boon dot disappear after a long rest.
- **Poison system:** Long Rest will clear long-rest poisons. The `poison_status` table has `duration` and `active` columns.
- **Initiative page:** Roll Initiative from the control bar logs a combat_start event before navigating. The initiative page itself doesn't change.
- **Session data model:** Two new nullable columns (`started_at`, `ended_at`) are backward-compatible.
- **Existing Long Rest button:** The inline Long Rest button in the Scene header should be replaced by or defer to the control bar version. Remove the old one to avoid confusion.

## Risks & Dependencies

- **Poison table schema:** Need to verify `poison_status.duration` values match what the long-rest API expects. If duration is stored as minutes (e.g. `'10'`), need a different filter than `= 'long_rest'`.
- **Boon expiry_type values:** Currently `'permanent'`, `'long_rest'`, `'timer'`. No explicit `'short_rest'` — may need to add one later.
- **Animation performance:** CSS pulse animations on two circles simultaneously. Should be fine with `@keyframes` + `animation` — avoid JS-driven animation.

## Reminders for User

- Add "Return to Session" button on Combat (Initiative) page ✓ (Unit 6)
- Add "Return to Session" button on Boons page ✓ (Unit 6)

## Sources & References

- Related code: `components/DmSessionsClient.tsx`, `components/InitiativePageClient.tsx`, `components/BoonsDmClient.tsx`
- Related API: `app/api/sessions/[id]/route.ts`, `app/api/boons/route.ts`, `app/api/poison/route.ts`
