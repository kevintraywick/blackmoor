---
title: "feat: DM Journal page (game-so-far + narrative notes)"
type: feat
status: active
date: 2026-04-06
---

# DM Journal Page

## Overview

Add a new DM-only `/dm/journal` page that consolidates the campaign's history into a single scrollable artifact. Each entry shows two columns side-by-side:

- **Left (read-only "Summary"):** auto-generated session stats (players, boons, poisons, NPCs killed) + the DM's private journal text for that session.
- **Right (editable "Narrative Notes"):** a new free-form field where the DM writes their own running narrative — themes, foreshadowing, what to bring back later.

Entries appear in reverse chronological order (most recent session first), with the **campaign background** (`campaign.background`) as the final entry. The campaign entry uses the same two-column layout.

## Problem Frame

The DM currently has private journal entries scattered across individual session rows on `/dm`, plus a campaign backstory on `/dm/campaign`. There is no single place to read the whole story-so-far in chronological order, and no place to write running narrative observations that aren't tied to a single session's events. The journal page provides a "story bible" view: a permanent, append-only chronicle of what happened (left) alongside the DM's authorial commentary (right).

## Requirements Trace

- **R1.** New DM-only route at `/dm/journal` with a banner image and reverse-chronological entry list.
- **R2.** Each entry has two columns: read-only summary (left) + editable narrative notes (right).
- **R3.** Summary column shows auto-stats (players, boons, poisons, kills) + the private `journal` text.
- **R4.** Entries include **all named sessions** (any session with a non-empty `title`) plus the campaign background as the final entry.
- **R5.** Narrative notes are editable inline and autosave on blur (matching the existing pattern on `/dm/campaign` and `/dm`).
- **R6.** Page is added to the DM nav.

## Scope Boundaries

- No public/player-facing journal — DM only.
- No rich-text editing in narrative notes; plain `<textarea>` matching existing patterns.
- No filtering, search, tagging, or per-entry collapse/expand.
- No image attachments per entry.
- No auto-summarization via LLM — the summary column is purely a join of existing data (stats + journal text).
- No new "snapshots" of stats — stats are computed live from the existing `/api/sessions/[id]/stats` endpoint pattern, same as DM Sessions page.
- No retroactive backfill of narrative notes — they start empty.

## Context & Research

### Relevant Code and Patterns

- **Server components fetching DB + image directories:** `app/dm/journey/page.tsx` is the cleanest example — parallel `Promise.all` of `query<Session>()`, image scan from `process.env.DATA_DIR`, and `[campaign]` lookup.
- **Two-column inline-editable layout:** `components/DmSessionsClient.tsx` lines 647-686 — `grid grid-cols-1 sm:grid-cols-2 gap-4` with private/public textareas, `bg-[var(--color-surface)] border border-[var(--color-border)] rounded`, blur-to-save pattern.
- **Stats endpoint:** `app/api/sessions/[id]/stats/route.ts` already returns `{ players, boons, poisons, killed }` per session — reuse the same shape, but fetch in bulk on the server (one query each, or batch in a new endpoint if needed at implementation time).
- **Autosave on blur pattern:** `components/CampaignPageClient.tsx` `handleNameBlur` / `handleBackgroundBlur` pattern — local state, blur handler that diffs against `initial.*`, debounced "Saved" flash.
- **Banner image pattern:** `app/dm/campaign/page.tsx` lines 19-27 — `<Image fill className="object-cover">` inside a `relative w-full h-48 sm:h-64` wrapper.
- **Nav registration:** `components/DmNav.tsx` line 7 (`NavSection` union) and the `LINKS` array (line 34) — add `'journal'` to both.

### Institutional Learnings

- **`ensureSchema` is memoized.** New DDL requires a dev-server restart to apply. Plan accordingly during execution.
- **Tailwind v4 + Safari production:** for layout-critical flex/grid containers (especially the two-column layout), prefer inline `style={{ display: 'grid', gridTemplateColumns: '...' }}` over Tailwind's `grid-cols-2`. See `feedback_safari_flex.md`.
- **Don't use scrollable sub-containers.** The page itself scrolls; per-entry textareas can grow with `resize-y` but no fixed `max-h`.

## Key Technical Decisions

- **Bulk-load all stats in the server component, not via per-entry client fetches.** The existing `/api/sessions/[id]/stats` endpoint is per-session; calling it from the client N times would cause a waterfall on page load. Instead, the server component will run the same aggregation logic in a single pass over all sessions (or a small helper function), so the rendered page is fully populated on first paint. Per-entry fetching is the wrong shape for a page that lists *every* session.
- **`narrative_notes` lives on `sessions` AND `campaign`.** Two separate columns rather than a new join table — narrative notes are 1:1 with their parent row, never multiple, and the rest of the codebase consistently uses additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for these one-off text fields.
- **Reuse the existing `PATCH /api/sessions/[id]` endpoint** for saving session narrative notes (it already accepts arbitrary text fields like `journal` / `journal_public` — confirm the field whitelist at implementation time and extend it if needed). For the campaign row, reuse `PATCH /api/campaign` (same `if (typeof body.narrative_notes === 'string')` pattern as `background`).
- **Order:** sort by `number DESC`, then append the campaign background row. Use `number` (not `date` or `created_at`) — it's the canonical ordering on every other DM page.
- **"All named sessions"** = `WHERE title IS NOT NULL AND title <> ''`. Avoids junk untitled rows and matches the user's intent.
- **Per-entry rendering:** the campaign row is rendered by the same `<JournalEntry>` component as session rows — pass it a `kind: 'session' | 'campaign'` discriminator that controls (a) the title shown, (b) which API endpoint to PATCH on save, and (c) the absence of stats lines (campaign has no stats).
- **No session_id in the campaign row's narrative-notes save path** — it routes to `/api/campaign` instead.

## Open Questions

### Resolved During Planning

- **Summary content?** Stats + journal text (per user).
- **Which sessions?** All named sessions, ordered by `number DESC`.
- **Narrative notes for campaign row?** Yes, same layout.
- **Scrolling?** Page-level only — no sub-container scroll.

### Deferred to Implementation

- Whether `PATCH /api/sessions/[id]` already accepts an arbitrary field map or needs `narrative_notes` added to its whitelist. If the latter, extend it minimally.
- Exact stats query shape for bulk loading — whether to issue one combined query joining `session_events` / `player_boons` / `poison_status` per session, or run the existing per-session aggregation in a loop on the server. Both are acceptable; pick whichever is simpler when the implementer reads the existing `stats/route.ts`.
- Banner image asset — reuse `journey_splash.png` or pick another existing banner. New art is out of scope for this plan.

## Implementation Units

- [ ] **Unit 1: Schema — add `narrative_notes` columns**

**Goal:** Persist DM narrative notes per session and on the campaign row.

**Requirements:** R2, R5

**Files:**
- Modify: `lib/schema.ts`

**Approach:**
- Add two `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements: one for `sessions.narrative_notes TEXT NOT NULL DEFAULT ''`, one for `campaign.narrative_notes TEXT NOT NULL DEFAULT ''`.
- Place both alongside the existing additive ALTERs near the bottom of `_initSchema()`, following the same `.catch(() => {})` style.
- Update the `Session` and `Campaign` interfaces in `lib/types.ts` to include `narrative_notes: string`.

**Patterns to follow:**
- The recently added `journal` / `journal_public` ALTERs (`lib/schema.ts:454-455`) and `background` ALTER (`lib/schema.ts:357-360`).

**Verification:**
- Restart the dev server. Confirm the columns exist via a quick `\d sessions` and `\d campaign` against the local DB. Both default to empty string and require no backfill.

---

- [ ] **Unit 2: API — accept `narrative_notes` on session and campaign PATCH**

**Goal:** Allow the journal page to save narrative notes via existing endpoints.

**Requirements:** R5

**Dependencies:** Unit 1

**Files:**
- Modify: `app/api/sessions/[id]/route.ts` (or wherever the session PATCH handler lives — confirm at implementation time)
- Modify: `app/api/campaign/route.ts`

**Approach:**
- For the session route, add `narrative_notes` to whatever field whitelist or `if (typeof body.narrative_notes === 'string')` block already exists for `journal` / `journal_public`.
- For the campaign route, mirror the existing `background` block: `if (typeof body.narrative_notes === 'string') { sets.push(...); vals.push(body.narrative_notes.trim()); }`.

**Patterns to follow:**
- `app/api/campaign/route.ts` lines 47-50 (the `description` block) and the `background` block we just added.

**Test scenarios:**
- PATCHing a session with `{ narrative_notes: "..." }` updates the row and returns 200.
- PATCHing the campaign with `{ narrative_notes: "..." }` updates and returns 200.
- Sending an empty string clears the field. Sending no field leaves it untouched.

**Verification:**
- `curl` PATCH from the terminal against the local server, then SELECT to confirm the column was written.

---

- [ ] **Unit 3: Server-side data fetch + page wrapper**

**Goal:** Build the `/dm/journal` route that loads all named sessions, their auto-stats, and the campaign row in a single request.

**Requirements:** R1, R3, R4

**Dependencies:** Unit 1

**Files:**
- Create: `app/dm/journal/page.tsx`
- Create: `lib/journal-stats.ts` *(small helper that, given a session id, returns `{ players, boons, poisons, killed }` — extracted from the existing `/api/sessions/[id]/stats/route.ts` so both the API and the page can call it. Optional: skip the extraction and inline the queries in the page if simpler.)*

**Approach:**
- Server component pattern, mirroring `app/dm/journey/page.tsx`.
- `await ensureSchema()`, then a `Promise.all([sessionsQuery, campaignQuery, statsBulkLoad])`.
- `sessionsQuery`: `SELECT * FROM sessions WHERE title IS NOT NULL AND title <> '' ORDER BY number DESC`.
- `campaignQuery`: `SELECT * FROM campaign LIMIT 1`.
- `statsBulkLoad`: for each returned session id, compute stats via the shared helper (or inline). Build a `Record<sessionId, Stats>` map and pass to the client component.
- Render `<DmNav current="journal" />` then `<DmJournalClient sessions={...} campaign={...} statsMap={...} />`.

**Patterns to follow:**
- `app/dm/journey/page.tsx` overall shape.
- `app/api/sessions/[id]/stats/route.ts` for the stats query logic (this is the source to extract from).

**Verification:**
- Hitting `/dm/journal` returns a fully populated page on first paint with no client-side waterfalls. Verify in the network tab that no `/api/sessions/.../stats` requests fire after load.

---

- [ ] **Unit 4: Client component — entry list + editable narrative notes**

**Goal:** Render the entries and let the DM edit narrative notes inline with autosave.

**Requirements:** R2, R3, R5

**Dependencies:** Unit 2, Unit 3

**Files:**
- Create: `components/DmJournalClient.tsx`

**Approach:**
- Client component receives `sessions`, `campaign`, and `statsMap` as props.
- Local state: `Record<entryKey, string>` for the current narrative notes values, plus a per-entry "saving / saved" flag.
- Render each session row using a `<JournalEntry>` subcomponent (kept inside the same file unless it grows). Then render one final entry for the campaign background.
- Each `<JournalEntry>` is a two-column grid (`gridTemplateColumns: '1fr 1fr'` via inline style for Safari reliability):
  - **Left column ("Summary"):** Title row (session number + title, or "Backstory"). Below: stats lines (gold-labelled `Players:`, `Boons:`, `Poisons:`, `Killed:` — same format as the DM Sessions stats block) followed by the journal/background text rendered as `whiteSpace: 'pre-wrap'`. The campaign entry omits the stats section.
  - **Right column ("Narrative Notes"):** A `<textarea>` (rows ≈ 8) bound to local state, autosaving on blur. The PATCH target is `/api/sessions/${id}` for session entries and `/api/campaign` for the campaign entry — branched on the entry's `kind` discriminator.
- Visual treatment: same warm parchment styling as the rest of the DM pages (`var(--color-surface)`, `border border-[var(--color-border)]`, `rounded`, EB Garamond). Stats use `text-[var(--color-gold)]` for labels.
- Entries are stacked vertically with generous spacing (e.g. `space-y-8` or 32px margin between entries). Each entry has a subtle separator/header so the eye can find it when scrolling.

**Patterns to follow:**
- `components/DmSessionsClient.tsx` lines 647-686 for the two-column textarea layout and stats block formatting.
- `components/CampaignPageClient.tsx` for the blur-to-save handler shape.

**Test scenarios:**
- Editing narrative notes for a session and tabbing out triggers a PATCH that writes the value; reloading the page shows the saved value.
- Editing narrative notes for the campaign entry routes to `/api/campaign` and persists.
- Sessions with no stats (no combat, no boons, no poisons) render the journal text without empty stats lines.
- Sessions with no journal text render the stats followed by an empty area (no error).
- The campaign entry is always last and never shows stats.
- Order: rendering matches `number DESC` followed by the campaign row.

**Verification:**
- Visit `/dm/journal`, edit a narrative notes field on the most recent session, tab out, reload — value persists. Repeat for the campaign entry.

---

- [ ] **Unit 5: Add Journal to DM nav**

**Goal:** Make the page reachable from every DM screen.

**Requirements:** R6

**Dependencies:** Unit 3

**Files:**
- Modify: `components/DmNav.tsx`

**Approach:**
- Add `'journal'` to the `NavSection` union (line 7).
- Add a new entry to the `LINKS` array (line 34): `{ key: 'journal', label: 'Journal', href: '/dm/journal' }`. Place it between `'sessions'` and `'players'`, or wherever it groups naturally with story/world tools — implementer's call.

**Verification:**
- Click "Journal" from any DM page and land on `/dm/journal`. Active state highlights correctly.

## System-Wide Impact

- **DDL touch:** two new columns. Both are additive and default to empty string — no migration risk, no backfill, no impact on existing reads.
- **Existing pages unaffected:** `/dm` (DM Sessions) reads `journal` directly and is unchanged. `/dm/campaign` reads `background` directly and is unchanged. No shared state to invalidate.
- **API surface:** `PATCH /api/sessions/[id]` and `PATCH /api/campaign` gain one optional field each. No breaking changes.
- **Performance:** loading every session's stats on a single page is the only meaningful concern. Bulk-loading server-side keeps the page render to one round-trip. Even at 50+ sessions this stays well under any practical threshold.

## Risks & Dependencies

- **Schema reload requires server restart.** Standard for this codebase — flag during execution so the implementer doesn't waste cycles wondering why writes fail.
- **`PATCH /api/sessions/[id]` field whitelist:** if the existing handler doesn't already accept arbitrary text fields, Unit 2 must extend it. Implementer should verify the file before assuming.
- **Tailwind v4 grid in Safari:** the two-column layout MUST use inline `style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}` rather than `grid-cols-2` — this is a known production gotcha (`feedback_safari_flex.md`).

## Documentation / Operational Notes

- Add a one-line entry to `DESIGN.md` under a new "DM Journal Page" subsection describing the two-column layout and that narrative notes autosave on blur.
- No CLAUDE.md update needed — the patterns reused are already documented elsewhere.

## Sources & References

- Related code: `app/dm/journey/page.tsx`, `app/dm/campaign/page.tsx`, `components/DmSessionsClient.tsx`, `components/CampaignPageClient.tsx`, `app/api/sessions/[id]/stats/route.ts`, `lib/schema.ts`, `components/DmNav.tsx`
- Related plan: `docs/plans/2026-04-04-001-feat-session-stats-auto-tracking-plan.md` (the stats endpoint this page will reuse)
