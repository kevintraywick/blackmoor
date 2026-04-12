---
title: "feat: Inline add/remove on /do roadmap page"
type: feat
status: active
date: 2026-04-12
---

# Inline Add/Remove on /do Roadmap Page

## Overview

Make the `/do` roadmap page editable: an input box under each column title for adding items, and a small X on every undone item for deleting them. Both operations write directly to `ROADMAP.md`.

## Requirements

- **R1.** Drop the subtitle text under each column title. Make titles slightly smaller.
- **R2.** One input box under each column title (Shadow, Common World).
- **R3.** Input format: `v{N} {feature text}`. Version prefix is required — reject without it.
- **R4.** On submit, append a new `- [ ] {feature text} <!-- {ladder}-v{N} -->` line to ROADMAP.md under the matching version section.
- **R5.** A small X appears at the right edge of every undone item (planned or in-progress, not built).
- **R6.** Clicking X permanently deletes the line from ROADMAP.md.
- **R7.** Page reflects changes immediately after add or delete (no full reload needed).

## Scope Boundaries

- No drag-and-drop reordering.
- No editing existing item text inline.
- No toggling built/unbuilt status from the page.
- The X does not appear on built items — those are permanent history.

## Key Technical Decisions

- **Server Actions for file writes.** The `/do` page is a server component. The add/delete operations need a server-side function that reads, modifies, and writes ROADMAP.md. Next.js Server Actions (or API routes) handle this. Given the page already uses `readFile`, a pair of API routes (`POST /api/roadmap/add`, `DELETE /api/roadmap/remove`) is the cleanest fit — keeps the page a pure server component and the mutations are explicit REST calls from a thin client wrapper.
- **Client wrapper for interactivity.** The current `DoPage` is a server component. The input boxes and X buttons need client interactivity. Extract the interactive parts into a `DoPageClient` component that receives the parsed roadmap as props, handles the input/delete UI, and calls the API routes. The server component (`page.tsx`) still loads and parses ROADMAP.md, then passes the data down.
- **Line-based identification.** Each roadmap item is identified by its exact text content (after tag stripping). The delete API matches on this text to find and remove the correct line. Collisions are astronomically unlikely given the item text is a full feature description.
- **Version validation.** The input parser extracts `v{N}` prefix. If the version doesn't exist in ROADMAP.md yet, the API creates a new `### {ladder} v{N} — planned` section header before inserting. This handles the empty Shadow v3 case.

## Implementation Units

- [ ] **Unit 1: API routes for add and delete**

  **Files:**
  - Create: `app/api/roadmap/add/route.ts`
  - Create: `app/api/roadmap/remove/route.ts`

  **Approach:**
  - `POST /api/roadmap/add` — body: `{ ladder: 'shadow'|'common', version: number, text: string }`. Reads ROADMAP.md, finds the section for that ladder+version (or creates it), appends a new `- [ ] {text} <!-- {ladder}-v{N} -->` line, writes the file back.
  - `DELETE /api/roadmap/remove` — body: `{ ladder: 'shadow'|'common', version: number, text: string }`. Reads ROADMAP.md, finds and removes the matching line, writes back. Returns 404 if not found.
  - Both use `readFile` / `writeFile` from `node:fs/promises`. File path: `path.join(process.cwd(), 'ROADMAP.md')`.

  **Verification:** curl POST to add an item, verify it appears in ROADMAP.md. curl DELETE to remove it, verify it's gone.

- [ ] **Unit 2: Client wrapper with input boxes and X buttons**

  **Files:**
  - Create: `components/DoPageClient.tsx`
  - Modify: `app/do/page.tsx` — server component passes parsed data to client component

  **Approach:**
  - `DoPageClient` receives `{ shadow: Ladder, common: Ladder }` as props.
  - Each column gets an input box styled to match the site aesthetic (EB Garamond, warm borders). Placeholder: `v3 feature name…` (Shadow) / `v6 feature name…` (Common).
  - On Enter: parse `v{N} {rest}`. If no match, show brief inline error "Start with v{N}" that fades after 2 seconds. If valid, POST to `/api/roadmap/add`, then re-fetch the page data (or optimistically add to local state).
  - Each undone item (`planned` or `in_progress`) gets a small X button at right edge. Clicking it calls DELETE `/api/roadmap/remove`, then removes from local state.
  - Built items (`status === 'built'`) have no X.
  - Deferred items have no X (they're already pruned).
  - Column titles: drop the subtitle line, reduce title font from `1.8rem` to `1.5rem`.

  **Patterns to follow:**
  - `components/CampaignPageClient.tsx` — input styling with `inputClass` pattern, fetch-based save.
  - Existing `VersionCard` and `LadderColumn` components move into the client file.

  **Verification:** Add an item via the input, see it appear. Click X, see it disappear. Refresh the page — changes persist (they're in ROADMAP.md).

## Risks

- **Concurrent writes.** If two tabs edit ROADMAP.md simultaneously, one write could overwrite the other. Acceptable for a single-user tool — Kevin is the only editor.
- **Git dirty state.** Every add/delete modifies ROADMAP.md on disk but doesn't commit. Kevin commits when ready. This matches how all other file-based state works in the project.
