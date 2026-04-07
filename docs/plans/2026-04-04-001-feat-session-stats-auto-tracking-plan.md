---
title: "feat: Auto-track session stats in private journal"
type: feat
status: active
date: 2026-04-04
---

# Auto-Track Session Stats in Private Journal

## Overview

Automatically capture session stats (players present, boons granted, poisons inflicted, NPCs killed) as the DM plays, and display them in the private journal pane on the DM sessions page.

## Problem Frame

The DM currently has an empty private journal textarea. Session stats like who played, what happened in combat, and what boons were awarded aren't captured anywhere structured. The DM has to remember and write this manually. By logging these events as they happen during a session, the private journal can show an auto-generated summary.

## Requirements

- R1. Players who roll initiative in a session are recorded as session participants
- R2. Boons granted during an active session are tagged with that session_id
- R3. Poisons inflicted during an active session are tagged with that session_id
- R4. NPCs whose HP reaches 0 during combat are logged as killed
- R5. The private journal pane shows auto-generated stats lines: players, boons, poisons, NPCs killed
- R6. Boons and poisons can be used across multiple sessions — each occurrence is tagged independently

## Scope Boundaries

- No treasure/item tracking (explicitly excluded)
- No changes to the public journal
- Stats are read-only display — the DM's free-text private journal remains as a separate textarea below the stats

## Key Technical Decisions

- **Session participants from initiative**: When `handleGo()` fires on the initiative page, log a `session_event` with type `combat_start` containing the player IDs in the combatant list. This already partially exists (combat_start event is logged) but doesn't include player IDs in the payload.
- **Boons/poisons get session_id column**: Add nullable `session_id` column to `player_boons` and `poison_status`. The UI passes the active session_id from localStorage when granting. Existing rows stay null (pre-feature data).
- **NPC killed = HP reaches 0**: When menagerie HP update lands at 0 via `PATCH /api/sessions/{id}`, log a `session_event` with type `npc_killed` and the NPC name/label in the payload.
- **Stats are queried, not stored**: The private journal stats are computed from session_events, player_boons, and poison_status at render time — not pre-generated text.

## Implementation Units

- [ ] **Unit 1: Add session_id to player_boons and poison_status**

  **Goal:** Allow boons and poisons to be linked to the session in which they were granted/inflicted.

  **Requirements:** R2, R3, R6

  **Files:**
  - Modify: `lib/schema.ts` — add `ALTER TABLE player_boons ADD COLUMN IF NOT EXISTS session_id TEXT` and same for `poison_status`
  - Modify: `app/api/boons/route.ts` — accept optional `session_id` param in POST, include in INSERT
  - Modify: `app/api/poison/route.ts` — accept optional `session_id` param in POST, include in INSERT

  **Approach:**
  - Nullable column — no migration needed for existing rows
  - API accepts `session_id` but doesn't require it (backwards compatible)
  - The UI will pass it from localStorage `blackmoor-last-session`

  **Patterns to follow:**
  - Existing `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pattern in `lib/schema.ts`
  - Existing POST handler pattern in both routes

  **Verification:**
  - POST /api/boons with session_id stores it in DB
  - POST /api/poison with session_id stores it in DB
  - Existing calls without session_id still work

- [ ] **Unit 2: Log player IDs in combat_start event**

  **Goal:** Record which players participated in combat so we know who was in the session.

  **Requirements:** R1

  **Files:**
  - Modify: `components/InitiativePageClient.tsx` — in `handleGo()`, include player IDs in the combat_start event payload

  **Approach:**
  - The `handleGo()` function already logs a `combat_start` session_event. Add `player_ids: string[]` to the payload, filtered from the combatant list where `type === 'player'`.
  - Player IDs are already available from the combatants array.

  **Verification:**
  - After rolling initiative, the session_events table has a `combat_start` row with `payload.player_ids` containing the participating player IDs

- [ ] **Unit 3: Pass session_id when granting boons and poisons**

  **Goal:** The UI sends the active session_id when granting boons or inflicting poisons.

  **Requirements:** R2, R3

  **Files:**
  - Modify: `components/BoonsDmClient.tsx` — pass session_id in the POST body when granting a boon
  - Modify: `components/DmSessionsClient.tsx` or wherever poison is inflicted from the DM UI — pass session_id

  **Approach:**
  - Read `localStorage.getItem('blackmoor-last-session')` to get active session_id
  - Include in the fetch body alongside existing params
  - Both boons and poison UIs already know the session context from localStorage

  **Verification:**
  - Grant a boon during a session → player_boons row has correct session_id
  - Inflict poison during a session → poison_status row has correct session_id

- [ ] **Unit 4: Log NPC killed events**

  **Goal:** When an NPC's HP reaches 0 in combat, log it as a session event.

  **Requirements:** R4

  **Files:**
  - Modify: `components/InitiativePageClient.tsx` — in `updateCombatantHp()`, detect when HP hits 0 and POST a session_event

  **Approach:**
  - After updating HP, check if new HP <= 0 and old HP > 0 (transition to dead, not repeated clicks)
  - POST to `/api/sessions/{sessionId}/events` with `event_type: 'npc_killed'` and `payload: { npc_name, npc_id, label }`
  - Use the combatant's display name and label (e.g., "Goblin 2")

  **Verification:**
  - Reduce NPC HP to 0 → session_events has `npc_killed` row with NPC name
  - Clicking - again at 0 HP does not log duplicate events

- [ ] **Unit 5: Display session stats in private journal pane**

  **Goal:** Show auto-generated stats lines above the free-text private journal textarea.

  **Requirements:** R5

  **Files:**
  - Modify: `app/dm/page.tsx` — query session stats (combat_start events, boons, poisons, npc_killed events) for the selected session
  - Modify: `components/DmSessionsClient.tsx` — render stats lines above the private journal textarea

  **Approach:**
  - Query from server component or via API:
    - `session_events WHERE session_id = ? AND event_type = 'combat_start'` → extract player_ids from payloads
    - `player_boons WHERE session_id = ?` → boon names + player names
    - `poison_status WHERE session_id = ?` → poison types + player names  
    - `session_events WHERE session_id = ? AND event_type = 'npc_killed'` → NPC names from payloads
  - Display format (4 lines, terse):
    - **Players:** Ash, Brandon, Cade, Eli
    - **Boons:** Inspiration → Ash, Lucky → Cade
    - **Poisons:** Poisoned → Brandon, Venom → Eli
    - **Killed:** Goblin 1, Goblin 2, Skeleton
  - Lines with no data show "—" or are omitted
  - Stats sit above the existing free-text textarea, visually separated

  **Patterns to follow:**
  - Existing session data fetching in `app/dm/page.tsx`
  - Existing pane styling in DmSessionsClient (gold section headers, serif body text)

  **Verification:**
  - Session with combat_start events shows player names
  - Session with boons shows boon→player mapping
  - Session with poisons shows poison→player mapping
  - Session with npc_killed events shows NPC names
  - Empty session shows no stats (or dashes)

## Risks & Dependencies

- **ensureSchema memoization**: After adding new DDL, dev server must be restarted
- **localStorage dependency**: session_id comes from localStorage, which may be stale if the DM has multiple tabs. Low risk — DM typically uses one tab.
- **Retroactive data**: Sessions 1 and 2 won't have any auto-tracked stats since they were played before this feature. That's fine — stats only populate going forward.

## Deferred to Implementation

- Exact styling/layout of the stats lines within the private journal pane
- Whether stats should refresh live or only on page load (page load is sufficient)
- Player name resolution (join against `players` table by ID)
