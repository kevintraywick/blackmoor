---
title: "feat: Player online presence indicator on splash page"
type: feat
status: active
date: 2026-04-03
---

# feat: Player online presence indicator on splash page

## Overview

Add a small red dot at the bottom of each player circle on the splash page that appears when that player currently has the site open in their browser, and disappears when they leave.

## Problem Frame

The DM and other players have no way to see who else is currently on the site. A subtle presence indicator on the splash page makes it immediately visible who's online — useful at session time to see who's ready, and between sessions to know who's checking their sheet.

## Requirements Trace

- R1. Red dot appears at the bottom of a player's circle on the splash page when they have the site open
- R2. Dot disappears when the player closes/navigates away from the site
- R3. Presence detection uses a heartbeat model — tab open counts, even if backgrounded
- R4. Dot is invisible (not an empty circle) when the player is offline
- R5. Works on both desktop and mobile splash layouts

## Scope Boundaries

- No presence indicator on the DM circle (DM doesn't have a player page that heartbeats)
- No "last seen" timestamp or tooltip — just the dot
- No presence tracking for DM pages
- No chat or notification triggered by presence changes

## Context & Research

### Relevant Code and Patterns

- `components/SplashNav.tsx` — renders player circles (desktop 96px, mobile 64px) with portrait images
- `lib/events.ts` + `app/api/events/route.ts` — existing SSE broadcast system with 30s heartbeat
- `lib/useSSE.ts` — client hook that subscribes to SSE events, pauses on tab hide, reconnects with backoff
- `app/players/[id]/page.tsx` — player page (server component), loads `PlayerSheet` client component
- `components/PlayerSheet.tsx` — main client component on every player page; good place to emit heartbeats
- Indicator dot patterns on player sheets: 14px circles, `position: absolute`, inline `style={{}}` for Safari compatibility

### Institutional Learnings

- `feedback_persist_everything.md` — state should persist to DB, not in-memory
- `feedback_safari_flex.md` — use inline styles for layout-critical elements (Safari + Tailwind v4)
- `feedback_ensureschema_fragility.md` — DDL must use `IF NOT EXISTS` + `.catch()`

## Key Technical Decisions

- **DB-backed presence** (not in-memory): A `player_presence` table stores `last_seen` timestamps. This survives server restarts and aligns with the project's "persist everything" principle.
- **Heartbeat interval: 30s, stale threshold: 90s**: Player pages POST to `/api/presence` every 30s. A player is "online" if `last_seen` is within 90s (allows for one missed heartbeat + network jitter).
- **SSE broadcast on presence change**: When a heartbeat arrives and the player was previously offline (or vice versa), broadcast a `presence` table event so the splash page updates in real-time without polling.
- **Heartbeat from PlayerSheet component**: Since every player page renders `PlayerSheet` (the main client component), the heartbeat `setInterval` lives there. Cleans up on unmount and pauses via `visibilitychange` is NOT needed (user chose heartbeat-while-tab-open model).
- **Splash page uses SSE + initial server fetch**: The splash page server component queries presence at render time. `SplashNav` (client) subscribes to SSE `presence` events and refetches to update dots.

## Open Questions

### Resolved During Planning

- **What counts as "on the site"?** → Tab open in browser, even if backgrounded (user chose heartbeat model)
- **Where does the heartbeat originate?** → `PlayerSheet` client component, which is present on every player page
- **How does the splash page learn about changes?** → SSE broadcast on presence change + initial server-rendered state

### Deferred to Implementation

- Exact cleanup mechanism for stale presence rows (could be a simple `DELETE WHERE last_seen < NOW() - interval '1 day'` in the heartbeat handler)

## Implementation Units

- [ ] **Unit 1: Database schema + presence API**

  **Goal:** Create the `player_presence` table and `/api/presence` endpoint (POST for heartbeat, GET for current status).

  **Requirements:** R1, R2, R3

  **Dependencies:** None

  **Files:**
  - Modify: `lib/schema.ts` — add `player_presence` table DDL
  - Create: `app/api/presence/route.ts` — POST (upsert `last_seen`) and GET (return online map)

  **Approach:**
  - Table: `player_presence` with `player_id TEXT PRIMARY KEY`, `last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - POST accepts `{ playerId }`, does `INSERT ... ON CONFLICT (player_id) DO UPDATE SET last_seen = NOW()`
  - Before returning, check if this player was previously offline (last_seen older than 90s before this update). If transitioning online, broadcast SSE event `{ table: 'presence', id: playerId, action: 'patch' }`
  - GET returns `{ online: string[] }` — all player IDs with `last_seen > NOW() - INTERVAL '90 seconds'`
  - Optionally clean up rows older than 1 day on each POST

  **Patterns to follow:**
  - Other API routes in `app/api/` (e.g., `app/api/dm-messages/route.ts`) for request/response shape
  - `broadcast()` from `lib/events.ts` for SSE notification
  - `ensureSchema` DDL pattern: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` or `CREATE TABLE IF NOT EXISTS` with `.catch()`

  **Verification:**
  - POST with a valid player ID returns 200 and upserts the row
  - GET returns that player in the online list
  - After 90s without heartbeat, GET no longer returns that player

- [ ] **Unit 2: Client-side heartbeat from player pages**

  **Goal:** Player pages send a heartbeat POST every 30s while the tab is open.

  **Requirements:** R1, R2, R3

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `components/PlayerSheet.tsx` — add `useEffect` with `setInterval` for heartbeat

  **Approach:**
  - In the `Sheet` component, add a `useEffect` that:
    1. Fires an immediate POST to `/api/presence` with `{ playerId }`
    2. Sets a 30s interval to repeat
    3. Cleans up the interval on unmount
  - No need to pause on `visibilitychange` — user wants heartbeat while tab is open
  - Fire-and-forget fetch (no error handling needed — missed heartbeats just mean the dot disappears after 90s)

  **Patterns to follow:**
  - Existing `setInterval` patterns in `PoisonClient.tsx` and `BoonsDmClient.tsx`

  **Verification:**
  - Opening a player page creates/updates a presence row in the DB
  - Closing the tab stops heartbeats; after 90s the player drops off the online list

- [ ] **Unit 3: Splash page presence dots**

  **Goal:** Show a small red dot at the bottom of each player circle on the splash page when that player is online.

  **Requirements:** R1, R4, R5

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Modify: `app/page.tsx` — query presence and pass to `SplashNav`
  - Modify: `components/SplashNav.tsx` — accept `onlinePlayers` prop, render dots, subscribe to SSE for live updates

  **Approach:**
  - Server side (`app/page.tsx`): fetch `/api/presence` or query DB directly to get online player IDs, pass as prop
  - Client side (`SplashNav.tsx`):
    - Accept `onlinePlayers: string[]` as initial state
    - Use `useSSE('presence', ...)` to listen for presence changes
    - On SSE event, refetch `/api/presence` GET to update the online set
    - For each player circle, if online: render a small red dot (`position: absolute`, bottom center of the circle)
    - Dot styling: `backgroundColor: '#dc2626'` (matches DM message dot red), ~10px on desktop, ~8px on mobile, `border: 2px solid #2e2825` (matches circle bg for clean edge)
    - Use inline `style={{}}` for positioning (Safari compatibility)
    - Dot is completely absent from DOM when player is offline (not an empty/invisible circle)

  **Patterns to follow:**
  - Indicator dots in `PlayerSheet.tsx` — absolute positioning within a `relative` container
  - `useSSE` hook usage in `PlayerMapPanel.tsx`
  - Inline styles for layout-critical elements per project conventions

  **Verification:**
  - Player opens their page → red dot appears on their circle on the splash page
  - Player closes their page → dot disappears after ~90s
  - Multiple players online → multiple dots visible
  - Works on both desktop and mobile layouts

## System-Wide Impact

- **SSE channel**: Adds `presence` as a new table name in the event stream. No conflict with existing tables.
- **DB**: One new lightweight table, very low write volume (8 players × 1 write/30s = ~16 writes/min max)
- **Network**: Minimal — one small POST every 30s per active player page

## Risks & Dependencies

- **Server restart clears SSE connections but not DB presence**: After a server restart, presence rows may show players as online for up to 90s until they go stale. This is acceptable — the dot will self-correct.
- **Railway cold starts**: If the Railway instance sleeps, the first heartbeat may be slow. Not a real concern since the site is actively used during sessions.
