---
title: "feat: DM private messages to players"
type: feat
status: active
date: 2026-03-30
---

# feat: DM private messages to players

## Overview

The DM can send private messages to individual players. Unread messages show as a pulsing red dot on the player's name bar. Clicking the dot opens an animated pane showing the message(s) with a themed background. Opening the pane auto-marks messages as read and clears the dot.

## Requirements Trace

- R1. DM can send text messages to individual players (DM message center UI — deferred to a follow-up unit)
- R2. Unread messages show a pulsing red dot on the player's character sheet, right-justified on the name bar above the stats row
- R3. Clicking the red dot opens an animated pane displaying messages, with `dm_message.png` as the background at 90% opacity
- R4. Opening the pane auto-marks all messages for that player as read and clears the dot
- R5. Message history — multiple messages can exist per player, not just one

## Scope Boundaries

- DM message center UI will be built separately (user confirmed "we'll build that in a bit")
- No real-time push (SSE) for now — messages appear on page load/refresh
- No player-to-DM replies in this iteration
- Messages are text only, no attachments

## Key Technical Decisions

- **New `dm_messages` table**: player_id, message text, timestamp, read boolean. Simple flat table, no threads.
- **API at `/api/dm-messages`**: GET (by player_id, returns unread + recent), POST (create), PATCH (mark as read)
- **Red dot on name bar**: Positioned in the existing flex layout of the name bar in `PlayerSheet`, right-justified. Uses Tailwind `animate-pulse` with a red background.
- **Message pane**: Slides down from the name bar area. Uses `dm_message.png` as a background image at 90% opacity. Shows messages in reverse chronological order (newest first).
- **Auto-dismiss**: When the pane opens, fire a PATCH to mark all unread messages for that player as read. The dot disappears immediately (optimistic).
- **Server-side unread count**: The player page server component queries unread count and passes it as a prop to `PlayerSheet`. No client-side polling.

## Implementation Units

- [ ] **Unit 1: Database table and API**

  **Goal:** Create the `dm_messages` table and CRUD API routes.

  **Requirements:** R1, R5

  **Files:**
  - Modify: `lib/schema.ts` — add `dm_messages` table (id TEXT PK, player_id TEXT, message TEXT, created_at BIGINT, read BOOLEAN DEFAULT false)
  - Modify: `lib/types.ts` — add `DmMessage` interface
  - Create: `app/api/dm-messages/route.ts` — GET (query by player_id), POST (create message)
  - Create: `app/api/dm-messages/read/route.ts` — PATCH (mark all unread for a player as read)

  **Patterns to follow:**
  - Existing API route pattern (ensureSchema, try/catch, NextResponse.json)
  - Schema migration pattern with `.catch(() => {})`

  **Verification:**
  - POST creates a message row, GET returns it, PATCH marks it read

- [ ] **Unit 2: Red dot indicator on player name bar**

  **Goal:** Show a pulsing red dot when unread messages exist.

  **Requirements:** R2

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `app/players/[id]/page.tsx` — query unread count, pass to Sheet
  - Modify: `components/PlayerSheet.tsx` — accept `unreadMessages` prop, render red dot in name bar

  **Approach:**
  - Server component queries `SELECT COUNT(*) FROM dm_messages WHERE player_id = $1 AND read = false`
  - Pass count to `<Sheet>` as `unreadCount` prop
  - In the name bar flex container (line ~418), add a red dot at the end: `<span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />`
  - Only render if `unreadCount > 0`

  **Patterns to follow:**
  - Existing prop-passing from page.tsx to Sheet component

  **Verification:**
  - With unread messages: red dot pulses on name bar
  - With no unread messages: no dot

- [ ] **Unit 3: Message pane with animated open**

  **Goal:** Clicking the red dot opens a pane showing messages with themed background.

  **Requirements:** R3, R4

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Modify: `components/PlayerSheet.tsx` — add message pane state, fetch messages on open, render pane with animation
  - Commit: `public/images/dm_messages/dm_message.png` (ensure it's in git)

  **Approach:**
  - Click handler on the red dot toggles a `showMessages` state
  - When opened: fetch `GET /api/dm-messages?player_id={id}` for message list
  - Simultaneously fire `PATCH /api/dm-messages/read` to mark all as read
  - Optimistically set `unreadCount` to 0 (dot disappears)
  - Pane renders below the name bar with:
    - `dm_message.png` as background, 90% opacity
    - Slide-down animation via Tailwind transition (max-height from 0 to auto, or translate-y)
    - Messages listed newest first with timestamps
  - Click the dot again (or a close area) to collapse

  **Patterns to follow:**
  - Existing client-side fetch patterns in the codebase
  - Tailwind transitions for animation

  **Verification:**
  - Red dot click opens pane with themed background
  - Messages display in reverse chronological order
  - Dot disappears after opening
  - Pane animates open/closed smoothly

## Deferred to Implementation

- Exact animation timing and easing
- Message timestamp formatting
- Whether to cap visible messages (show last N)

## Risks & Dependencies

- `dm_message.png` must be committed to git or Railway won't serve it
- No DM send UI yet — for testing, messages can be inserted via API or psql
