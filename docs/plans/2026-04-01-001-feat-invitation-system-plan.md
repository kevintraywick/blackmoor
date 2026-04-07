---
title: "feat: Invitation system — DM creates shareable availability polls"
type: feat
status: active
date: 2026-04-01
---

# feat: Invitation system — DM creates shareable availability polls

## Overview

The DM creates named availability polls ("invitations") from the Campaign page. Each invitation has up to 5 dates, generates a unique shareable URL, and renders as a CanYouPlay-style page where players mark in/out/maybe per date.

## Problem Frame

The current `/canyouplay` page has hardcoded dates. The DM cannot create new availability polls or share links for specific date sets. This feature makes scheduling self-service — the DM picks dates, gets a link, shares it in Discord.

## Requirements Trace

- R1. "New Invitation" circle on Campaign page (same size as player circles)
- R2. Clicking it opens a popup calendar where DM selects up to 5 dates
- R3. On confirm, an invitation is created with a slug based on the earliest date: `canyouplay_{month}_{day}` (e.g. `canyouplay_apr_05`)
- R4. The invitation page uses the same CanYouPlay template (all players, same dot system, same sounds)
- R5. A "Copy Link" button appears below the circle after creation, labeled "{earliest date} Invitation"
- R6. Created invitations persist and are listed on the Campaign page

## Scope Boundaries

- No auth on invitation pages (consistent with existing `/canyouplay`)
- No email notifications on invitation pages (quorum email stays on the original `/canyouplay` only)
- No editing or deleting invitations in v1 (can add later)
- Calendar popup is an exception to the no-popup DESIGN.md rule (user approved)

## Context & Research

### Relevant Code and Patterns

- `components/CanYouPlayClient.tsx` — the template to reuse. Currently calls `getNextSaturdays()` for dates. Needs to accept dates as a prop instead.
- `app/canyouplay/page.tsx` — server page pattern: `ensureSchema()`, query, pass props
- `app/api/availability/route.ts` — PUT handler with upsert. The `saturday` column stores any ISO date string, not just Saturdays.
- `components/CampaignPageClient.tsx` — where the "New Invitation" circle and created invitation links will live
- `lib/schema.ts` — DDL pattern: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... .catch(() => {})`
- Player circles: 58-64px with gold border, used on player selector and NPC casting board

### Institutional Learnings

- `ensureSchema` is memoized — restart dev server after DDL changes
- Tailwind v4 arbitrary values unreliable — use inline styles for precise sizing
- Safari has flex-wrap/gap issues — use inline `style={{ gap }}` not Tailwind gap classes
- Dates stored as `YYYY-MM-DD` TEXT strings in `availability.saturday` column

## Key Technical Decisions

- **New `invitations` table** (not a JSONB column on campaign): Cleaner — supports multiple invitations, each with its own slug and dates. Dates stored as JSONB array of ISO strings.
- **Reuse `CanYouPlayClient`** by making dates a prop: Add optional `dates` prop. If provided, use it; otherwise fall back to `getNextSaturdays()`. Avoids duplicating the entire component.
- **Dynamic route `app/canyouplay/[slug]/page.tsx`**: Loads invitation by slug, fetches availability rows filtered to those dates, renders CanYouPlayClient with dates prop.
- **Slug format**: `apr_05` (lowercase month abbreviation + underscore + zero-padded day of earliest date). URL becomes `/canyouplay/apr_05`.
- **Popup calendar**: Simple overlay with a 6-week grid of clickable date cells. No external library — hand-built with the app's existing styling. Max 5 selections highlighted in gold.
- **Availability table reused as-is**: The `saturday` column already accepts any ISO date string. No schema change needed for availability — just new rows with the invitation's dates.

## Open Questions

### Resolved During Planning

- **Calendar library?** No — hand-build a simple month grid. The app has no npm calendar dependency and adding one for this is overkill.
- **What if two invitations have the same earliest date?** Append a suffix: `apr_05`, `apr_05_2`, etc. Check for slug collision on creation.
- **Where does the invitation list live?** On the Campaign page, below the existing fields. Each created invitation shows as a row with the label and a copy-link button.

### Deferred to Implementation

- Exact popup overlay positioning and close-on-click-outside behavior
- Whether the calendar grid shows one month or two side-by-side
- Animation for popup open/close

## Implementation Units

- [ ] **Unit 1: Invitations table + type**

  **Goal:** Create the DB table and TypeScript interface for invitations.

  **Requirements:** R3, R6

  **Dependencies:** None

  **Files:**
  - Modify: `lib/schema.ts`
  - Modify: `lib/types.ts`

  **Approach:**
  - Add `invitations` table: `id TEXT PK, slug TEXT UNIQUE, label TEXT, dates JSONB, created_at BIGINT`
  - Add `Invitation` interface to types
  - Use `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` pattern with `.catch(() => {})`

  **Patterns to follow:**
  - Existing DDL blocks in `lib/schema.ts` (e.g. `boon_templates`, `availability`)

  **Verification:**
  - Dev server restarts cleanly, table exists in DB

- [ ] **Unit 2: Invitations API**

  **Goal:** CRUD endpoints for invitations.

  **Requirements:** R3, R6

  **Dependencies:** Unit 1

  **Files:**
  - Create: `app/api/invitations/route.ts`

  **Approach:**
  - GET: return all invitations ordered by `created_at DESC`
  - POST: accept `{ dates: string[] }`, validate 1-5 dates, compute slug from earliest date (handle collision), compute label, insert row, return the invitation with full URL
  - Slug: `apr_05` format from earliest date. If slug exists, append `_2`, `_3`, etc.

  **Patterns to follow:**
  - `app/api/campaign/route.ts` for the request/response shape
  - `app/api/availability/route.ts` for the upsert pattern

  **Verification:**
  - POST creates invitation, GET returns it, slug is unique

- [ ] **Unit 3: Make CanYouPlayClient accept dynamic dates**

  **Goal:** Allow CanYouPlayClient to render any set of dates, not just hardcoded Saturdays.

  **Requirements:** R4

  **Dependencies:** None (can be done in parallel with Units 1-2)

  **Files:**
  - Modify: `components/CanYouPlayClient.tsx`
  - Modify: `app/canyouplay/page.tsx`

  **Approach:**
  - Add optional `dates?: string[]` prop to CanYouPlayClient
  - If `dates` is provided, use it. Otherwise call `getNextSaturdays()` as today.
  - The existing `/canyouplay` page passes no dates prop — behavior unchanged.

  **Patterns to follow:**
  - Existing prop pattern in CanYouPlayClient

  **Verification:**
  - `/canyouplay` works exactly as before (no regression)
  - Component renders correctly when given arbitrary dates

- [ ] **Unit 4: Dynamic invitation page route**

  **Goal:** `/canyouplay/[slug]` renders the invitation's dates using CanYouPlayClient.

  **Requirements:** R3, R4

  **Dependencies:** Units 1, 2, 3

  **Files:**
  - Create: `app/canyouplay/[slug]/page.tsx`

  **Approach:**
  - Server component: `ensureSchema()`, query invitation by slug, fetch players, fetch availability filtered to those dates, render CanYouPlayClient with `dates` prop
  - If slug not found, return `notFound()`
  - `force-dynamic` as all other pages

  **Patterns to follow:**
  - `app/players/[id]/page.tsx` for dynamic route structure
  - `app/canyouplay/page.tsx` for the data fetching pattern

  **Verification:**
  - `/canyouplay/apr_05` renders with the invitation's dates
  - Unknown slug shows 404

- [ ] **Unit 5: Campaign page — New Invitation circle + popup calendar + invitation list**

  **Goal:** DM can create invitations from the Campaign page and copy shareable links.

  **Requirements:** R1, R2, R5, R6

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `components/CampaignPageClient.tsx`

  **Approach:**
  - Add a "New Invitation" circle (64px, gold border, same style as NPC circles) right-aligned on the page
  - Clicking opens a calendar popup overlay: simple month grid, clickable date cells, up to 5 selected (highlighted gold), confirm/cancel buttons
  - On confirm: POST to `/api/invitations`, receive slug
  - Below the circle, list created invitations: each row shows the label + a "Copy Link" button that copies the full URL to clipboard
  - Fetch invitations on mount via GET `/api/invitations`

  **Patterns to follow:**
  - NPC circle rendering in `DmSessionsClient.tsx` for circle styling
  - Campaign page save pattern for API calls

  **Verification:**
  - Circle renders at correct size
  - Calendar popup opens, allows up to 5 date selections
  - Invitation created, link copyable, page at that URL works

## System-Wide Impact

- **Availability table:** Reused as-is. New invitation dates create new `(player_id, date)` rows via the existing PUT endpoint. No schema change.
- **Quorum notifications:** Only fire on the original `/canyouplay` PUT handler. Invitation pages use the same API, so they will also trigger quorum emails — this may or may not be desired. Consider skipping quorum check for invitation dates in a follow-up.
- **CanYouPlayClient:** Adding an optional prop is backward-compatible. No risk to existing `/canyouplay`.

## Risks & Dependencies

- **ensureSchema restart:** After adding the invitations table DDL, the dev server must be restarted. Known gotcha.
- **Safari popup:** The calendar overlay needs careful positioning. Test in Safari specifically.
- **Slug collision:** Handled by appending `_2`, `_3`, etc. Low risk with a small group.

## Sources & References

- Related code: `components/CanYouPlayClient.tsx`, `components/CampaignPageClient.tsx`
- Related memory: `project_can_you_play.md`
