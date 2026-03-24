# DM Sessions Redesign

**Goal:** Replace the draggable session list on `/dm` with a session picker row + inline session form, keeping all editing on one page.

**Architecture:** Single client component (`DmSessionsClient`) handles session selection, creation, and inline editing. SessionForm is embedded directly rather than navigated to. No drag-to-reorder.

**Tech Stack:** Next.js App Router, React client component, existing API routes, existing SessionForm component (reused inline).

---

## Layout

```
DmNav (sticky)
─────────────────────────────────────────
Session box row (below nav, full-width strip)
  [ #1 The Wolf… ] [ #2 The Barrow… ] [ #3 ] [ + ]
─────────────────────────────────────────
Session detail area (below row, padded)
  #1  The Wolf Arrives        [autosave indicator]
  March 1, 2025
  ─────────────────────────
  Goal / Hook         [textarea, full width, 3 rows]
  Scene Outline       [textarea, full width, 7 rows]
  Key NPCs | Locations       [2-col, 5 rows each]
  Loose Ends | Notes         [2-col, 4 rows each]
```

## Session Box Row

- Horizontal flex row, `overflow-x: auto` for many sessions
- Each box: ~88px wide, border, rounded, shows `#N`, truncated title, date
- Selected box: amber border (`#c9a84c`), slightly lighter bg
- Unselected boxes: muted border, dim text
- `+` box at end: dashed border, `+` glyph — creates new session and auto-selects it
- No drag-to-reorder (removed)

## Session Detail Panel

- Separate bordered box below the row (not visually connected to selected box)
- Reuses all fields from `SessionForm`: number, title, date, goal, scenes, npcs, locations, loose_ends, notes
- Same autosave behavior (600ms debounce, PATCH `/api/sessions/[id]`)
- Same two-column layout for npcs/locations and loose_ends/notes
- When no session exists yet (empty state): show a prompt to create the first one

## Session Creation

- Clicking `+` calls `POST /api/sessions`, auto-increments number
- New session is immediately selected and detail panel opens
- No page navigation

## Files

- **Modify:** `app/dm/page.tsx` — remove the `max-w-[480px]` width wrapper and SessionList; render DmSessionsClient full-width
- **Create:** `components/DmSessionsClient.tsx` — new client component (session box row + inline form fields)
- **Keep:** `components/SessionForm.tsx` — NOT embedded directly; DmSessionsClient replicates its field rendering inline (avoids fixed-position save indicator and outer padding wrapper conflicts)
- **Keep:** `components/SessionList.tsx` — no longer used on /dm but not deleted
- **Keep:** `app/sessions/[id]/page.tsx` — unchanged, still works for direct links

## State

DmSessionsClient holds:
- `sessions: Session[]` — initialized from server props, updated optimistically on create
- `selectedId: string | null` — which session box is active
- `values: Record<string, string | number>` — live field values for selected session
- `saveStatus: 'idle' | 'saving' | 'saved' | 'failed'`

## Session Creation Detail

- Client computes `maxNum = Math.max(...sessions.map(s => s.number), 0)` and sends `{ id: Date.now().toString(36), number: maxNum + 1 }` to `POST /api/sessions`
- Server owns `sort_order`: the POST route sets it to `COUNT(*) of existing rows` — client does not send sort_order
- New session appended optimistically to `sessions` state and auto-selected

## Field Edit Notes

- The `number` field is NOT in the server's PATCH allowlist (`SESSION_COLUMNS`) — session number edits will be silently dropped. This is pre-existing behavior; the inline form should include the number display but the number field should be read-only in the detail panel (or omitted from autosave calls)

## Display Order

- Session boxes rendered sorted by `sort_order ASC, number ASC` (same as the existing API query order)
- `sort_order` for new sessions = `maxNum + 1` (matches number); existing sessions keep their sort_order

## Empty State

- The `+` box is always present in the row, even when no sessions exist
- When `sessions` is empty and no session is selected: detail panel shows a prompt ("No sessions yet — click + to create your first one")

## Autosave

- 600ms debounce on any field change, calls `PATCH /api/sessions/[id]` with the changed field
- Save status indicator rendered inside the detail panel (inline, bottom-right), not `fixed` positioned

## API Routes (unchanged)

- `GET /api/sessions` — fetch all sessions
- `POST /api/sessions` — create new session
- `PATCH /api/sessions/[id]` — update individual fields

## Out of Scope

- Drag-to-reorder (removed)
- Deleting sessions from this page (kept only in old SessionList; can be added later)
- Maps link inside the detail panel (DmNav already links to Maps)
