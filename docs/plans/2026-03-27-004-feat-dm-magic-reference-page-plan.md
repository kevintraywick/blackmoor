---
title: "feat: DM Magic reference page with Open5e search and persistent catalog"
type: feat
status: completed
date: 2026-03-27
---

# feat: DM Magic reference page with Open5e search and persistent catalog

## Overview

Build a Magic reference page for the DM with four category panes (Spells, Scrolls, Magic Items, Other), a search bar that fetches descriptions from the Open5e SRD API, and a persistent icon catalog so the DM can quickly reload previously looked-up items during play.

## Problem Frame

The DM needs quick mid-session access to spell descriptions, magic item properties, and scroll details without leaving the app or flipping through books. Currently the Magic page is a placeholder. The DM should be able to search by name, get the full SRD description, and build up a visual catalog of frequently referenced items that persists across sessions.

## Requirements Trace

- R1. Four visible panes: Spells, Scrolls, Magic Items, Other
- R2. Search bar above panes with 4 category buttons (right-justified)
- R3. Searching loads the item's description into the corresponding category pane
- R4. Spells and Scrolls query the Open5e `/v2/spells/` endpoint; Scrolls frames results as "Scroll of [Name]"
- R5. Magic Items queries the Open5e `/v2/items/?is_magic_item=true` endpoint
- R6. Other is a local catch-all — DM enters name and description manually, stored in DB
- R7. Each search adds a persistent catalog icon (small icon + title) between the search bar and panes
- R8. Catalog icons persist across page loads (stored in DB)
- R9. Clicking a catalog icon reloads that item's description into its category pane
- R10. A pane's description is replaced when a new search lands in that pane, but catalog icons remain
- R11. When search returns multiple matches, results are shown visibly (not a dropdown) for the DM to pick from

## Scope Boundaries

- NOT adding spell slot tracking or usage counting
- NOT integrating with player character sheets (their `spells[]` field is separate)
- NOT adding homebrew spell creation (Other pane covers ad-hoc notes)
- NOT caching Open5e responses server-side beyond the catalog entries
- NOT supporting offline mode (Open5e requires internet)

## Context & Research

### Relevant Code and Patterns

- `app/dm/magic/page.tsx` — existing placeholder page, already in nav as "magic"
- `components/DmNav.tsx` — nav already has `magic` section, no changes needed
- `app/dm/npcs/page.tsx` + `components/NpcPageClient.tsx` — canonical server/client split pattern
- `app/dm/inventory/page.tsx` + `components/InventoryPageClient.tsx` — item grid display pattern
- `lib/schema.ts` — DDL with `CREATE TABLE IF NOT EXISTS` + idempotent migrations
- `lib/types.ts` — type definitions for all DB entities
- `lib/useAutosave.ts` — debounced save hook (may not be needed here; catalog saves are explicit)
- `app/api/npcs/route.ts` — CRUD API route pattern with JSONB support
- `lib/srd-hp.ts` — existing SRD data pattern (local lookup, not API — different approach here)
- `app/globals.css` — design tokens: `--color-bg`, `--color-gold`, `--color-border`, `--color-surface`, etc.

### Open5e API v2

- **Spells**: `GET https://api.open5e.com/v2/spells/?search={query}&format=json`
  - Returns: `{ count, next, previous, results: [{ key, name, level, school: { name }, casting_time, range_text, verbal, somatic, material, material_specified, duration, concentration, ritual, desc, higher_level, ... }] }`
- **Items (magic)**: `GET https://api.open5e.com/v2/items/?search={query}&is_magic_item=true&format=json`
  - Returns: `{ count, next, previous, results: [{ key, name, desc, category: { name }, rarity: { name }, requires_attunement, ... }] }`
- Both endpoints support `?search=` for name matching and return paginated results
- No authentication required

### Key Data Flow

```
Search Flow:
  DM types name → clicks category button
    → [Spells/Scrolls] POST /api/magic/search { q, category: "spell" }
       → proxy to Open5e /v2/spells/?search=q
       → return results list
    → [Magic Items] POST /api/magic/search { q, category: "magic_item" }
       → proxy to Open5e /v2/items/?search=q&is_magic_item=true
       → return results list
    → [Other] → show inline editor for DM to type description

  DM picks a result (or writes "Other" description)
    → description loads into category pane
    → POST /api/magic/catalog → saves entry to magic_catalog table
    → catalog icon appears in strip

Catalog Reload Flow:
  DM clicks catalog icon
    → cached description loads from magic_catalog.description into pane
    → no API call needed (description was cached on first save)
```

## Key Technical Decisions

- **Open5e proxy route**: API calls go through `/api/magic/search` server-side to avoid CORS and keep the API URL out of the client bundle. The proxy is stateless — it does not cache results.
- **Catalog stores cached descriptions**: When the DM selects a result, the full description is saved to `magic_catalog` so reloading from the catalog never needs another API call. This also means offline reload works for previously saved items.
- **Scrolls reuse the spells endpoint**: Scrolls and Spells query the same Open5e `/v2/spells/` endpoint. The Scrolls pane prepends "Scroll of" to the display name and the description pane adds scroll mechanics context.
- **"Other" is local-only**: No API call. The DM enters name + description, saved directly to `magic_catalog`.
- **Catalog is global (not session-scoped)**: The DM builds up a reference library that persists across all sessions. No session FK needed.
- **Multiple search results shown as visible list**: Per UI preferences (no hidden-choice controls), when a search returns multiple matches, they appear as a clickable result list below the search bar. The DM clicks one to load it.
- **Category-specific icons in catalog**: Since Open5e doesn't return images, each catalog entry gets a category-based sigil/symbol (e.g., a star for spells, a scroll icon for scrolls, a gem for magic items, a quill for other) rendered with CSS/SVG, matching the warm aesthetic.
- **Four panes in a responsive grid**: 4-column on desktop, 2x2 on medium, stacked on mobile. Each pane shows the last-loaded description for that category.

## Open Questions

### Resolved During Planning

- **Where does spell data come from?** Open5e SRD API v2 (user confirmed).
- **What are Scrolls?** Reference lookup using the same spells endpoint, framed as "Scroll of [Name]" (user confirmed).
- **What is "Other"?** General catch-all for DM's custom notes — local DB, no API (user confirmed).
- **Should catalog be session-scoped or global?** Global — the DM builds a reference library over time.

### Deferred to Implementation

- **Exact catalog icon SVG/CSS design**: Category-based sigils matching the warm aesthetic. Exact visual deferred.
- **How many search results to show**: Open5e returns paginated results. Show the first 10-20 matches. Exact UX for "load more" deferred.
- **Catalog ordering**: Newest first, or alphabetical? Default to newest-first (most recently added at the left). Can revisit.
- **Catalog deletion**: Should the DM be able to remove catalog entries? Likely yes (small X on hover). Exact interaction deferred.

## Implementation Units

- [x] **Unit 1: DB schema and types**

  **Goal:** Create the `magic_catalog` table and `MagicCatalogEntry` TypeScript type.

  **Requirements:** R7, R8

  **Dependencies:** None

  **Files:**
  - Modify: `lib/schema.ts`
  - Modify: `lib/types.ts`

  **Approach:**
  - Add `magic_catalog` table: `id` (TEXT PK, uuid), `category` (TEXT: spell, scroll, magic_item, other), `name` (TEXT), `api_key` (TEXT, nullable — the Open5e key for API-sourced entries), `description` (TEXT — cached full description), `metadata` (JSONB — level, school, rarity, etc. varies by category), `created_at` (INTEGER, epoch)
  - Add `MagicCatalogEntry` interface to `lib/types.ts`

  **Patterns to follow:**
  - `lib/schema.ts` existing `CREATE TABLE IF NOT EXISTS` pattern
  - `lib/types.ts` existing interface patterns (e.g., `Npc`, `Session`)

  **Test scenarios:**
  - Schema creates table without errors on fresh DB
  - Re-running `ensureSchema()` is idempotent

  **Verification:**
  - `npx next build` succeeds

- [x] **Unit 2: Open5e proxy API route**

  **Goal:** Server-side API route that proxies search queries to Open5e, avoiding CORS and abstracting the external API from the client.

  **Requirements:** R3, R4, R5, R11

  **Dependencies:** None (can be built in parallel with Unit 1)

  **Files:**
  - Create: `app/api/magic/search/route.ts`

  **Approach:**
  - `POST /api/magic/search` accepts `{ q: string, category: "spell" | "magic_item" }`
  - For `spell`: fetch `https://api.open5e.com/v2/spells/?search=${q}&format=json`
  - For `magic_item`: fetch `https://api.open5e.com/v2/items/?search=${q}&is_magic_item=true&format=json`
  - Return a normalized results array: `{ key, name, description, metadata }` — flatten Open5e's nested structure into a consistent shape
  - Handle errors gracefully (Open5e down → return error message, not crash)

  **Patterns to follow:**
  - `app/api/sessions/[id]/route.ts` for API route structure
  - Keep it simple — no caching, no auth

  **Test scenarios:**
  - Search "fireball" with category "spell" → returns spell results
  - Search "bag of holding" with category "magic_item" → returns magic item results
  - Empty query → returns empty results or validation error
  - Open5e unreachable → returns 502 with error message

  **Verification:**
  - `curl -X POST /api/magic/search -d '{"q":"fireball","category":"spell"}'` returns spell data

- [x] **Unit 3: Catalog CRUD API routes**

  **Goal:** API routes for reading, adding, and deleting catalog entries from the `magic_catalog` table.

  **Requirements:** R7, R8, R9

  **Dependencies:** Unit 1

  **Files:**
  - Create: `app/api/magic/catalog/route.ts`
  - Create: `app/api/magic/catalog/[id]/route.ts`

  **Approach:**
  - `GET /api/magic/catalog` — returns all catalog entries ordered by `created_at DESC`
  - `POST /api/magic/catalog` — creates a new entry with `{ category, name, api_key, description, metadata }`; generates uuid for id
  - `DELETE /api/magic/catalog/[id]` — removes a catalog entry
  - All routes call `ensureSchema()` first

  **Patterns to follow:**
  - `app/api/npcs/route.ts` + `app/api/npcs/[id]/route.ts` for CRUD pattern

  **Test scenarios:**
  - POST creates entry, GET returns it
  - DELETE removes entry, subsequent GET excludes it
  - POST with duplicate api_key + category is allowed (DM may want multiple references)

  **Verification:**
  - Full CRUD cycle works via curl/fetch

- [x] **Unit 4: Magic page server component + client scaffolding**

  **Goal:** Replace the placeholder Magic page with a server component that fetches the catalog and a client component with the search bar, 4 category buttons, 4 panes, and basic search flow.

  **Requirements:** R1, R2, R3, R4, R5, R10, R11

  **Dependencies:** Units 1, 2, 3

  **Files:**
  - Modify: `app/dm/magic/page.tsx`
  - Create: `components/MagicPageClient.tsx`

  **Approach:**
  - Server component: `ensureSchema()`, fetch catalog entries via `query<MagicCatalogEntry>()`, pass to client
  - Client component layout:
    - Search bar (text input) + 4 category buttons (Spells, Scrolls, Magic Items, Other) right-justified
    - When DM types and clicks a category button: call `/api/magic/search`, show results as a visible clickable list below the search bar
    - When DM clicks a result: load description into that category's pane, call POST `/api/magic/catalog` to save
    - 4 panes in a responsive grid (4-col desktop, 2x2 medium, stacked mobile) each showing the last-loaded description for that category
    - Each pane has a category header styled consistently with the page aesthetic
    - "Other" button flow: instead of API search, show an inline text area in the Other pane for the DM to type a description, with a "Save" button
  - Styling: warm browns, EB Garamond serif, gold accents — match existing DM pages

  **Patterns to follow:**
  - `app/dm/npcs/page.tsx` + `components/NpcPageClient.tsx` for server/client split
  - `app/dm/inventory/page.tsx` for grid display patterns
  - `app/globals.css` design tokens for colors and typography

  **Test scenarios:**
  - Search "fireball" → click Spells → results list appears → click one → Spells pane shows description
  - Search "bag of holding" → click Magic Items → results list → click one → Magic Items pane shows description
  - Search "cure wounds" → click Scrolls → results appear (from spells API) → click one → Scrolls pane shows "Scroll of Cure Wounds" with description
  - Click Other → inline editor appears → DM types name + description → saves
  - New search in same pane replaces the old description
  - Empty search → no API call or appropriate message

  **Verification:**
  - All 4 category search flows work end-to-end
  - Pane descriptions display correctly with proper formatting
  - Page renders with correct warm aesthetic

- [x] **Unit 5: Persistent catalog strip**

  **Goal:** Add the catalog icon strip between the search bar and panes. Icons are loaded from DB on page load and added dynamically on new searches. Clicking an icon reloads that item's cached description into its pane.

  **Requirements:** R7, R8, R9, R10

  **Dependencies:** Unit 4

  **Files:**
  - Modify: `components/MagicPageClient.tsx`

  **Approach:**
  - Catalog strip renders between search bar row and panes grid
  - Each entry shows a small category-based icon/sigil + item name below it
  - Icons are color-coded or shape-coded by category (e.g., star/wand for spells, scroll for scrolls, gem for magic items, quill for other)
  - Clicking an icon: loads `catalog_entry.description` into the appropriate category pane (no API call)
  - New entries appear at the left (newest first)
  - Optional: small X button on hover to delete a catalog entry (calls DELETE API)
  - Catalog loaded from server props on initial render; new entries added to local state + DB on search

  **Patterns to follow:**
  - NPC Casting Board in `DmSessionsClient.tsx` for a horizontal icon strip pattern
  - HP chips pattern for small interactive elements

  **Test scenarios:**
  - Page loads with existing catalog entries displayed
  - New search adds icon to catalog strip immediately
  - Clicking catalog icon loads cached description (no network request for Spells/Magic Items)
  - Deleting a catalog icon removes it from strip and DB
  - Catalog persists across page reloads

  **Verification:**
  - Reload page → catalog icons still present
  - Click icon → description loads in correct pane

- [x] **Unit 6: Polish and responsive layout**

  **Goal:** Finalize responsive layout, loading states, error handling, and visual polish to match the Blackmoor aesthetic.

  **Requirements:** R1, R2 (layout refinement)

  **Dependencies:** Units 4, 5

  **Files:**
  - Modify: `components/MagicPageClient.tsx`
  - Modify: `app/dm/magic/page.tsx` (banner image if available)

  **Approach:**
  - Add loading spinner/state while Open5e search is in progress
  - Add error state if Open5e is unreachable ("The arcane library is unreachable" or similar thematic message)
  - Responsive grid: 4-col on `lg:`, 2x2 on `md:`, stacked on mobile
  - Empty state for each pane ("Search for a spell to see its description here")
  - Pane descriptions: format spell level, school, casting time, range, components, duration as a structured header above the description text
  - Magic item descriptions: format rarity, attunement requirement, category as structured header
  - Ensure keyboard flow works: type in search → Enter or click button → results → click result

  **Patterns to follow:**
  - Existing page layouts (NPC page, Sessions page) for responsive patterns
  - Design system tokens from `globals.css`
  - "Physical artifact" aesthetic: panes should feel like pages of a spellbook or reference tome

  **Test scenarios:**
  - Mobile layout: panes stack vertically, search bar and buttons wrap gracefully
  - Slow network: loading state visible during Open5e fetch
  - Open5e down: error message appears, doesn't break the page
  - All category panes have appropriate empty states

  **Verification:**
  - Page looks correct at desktop, tablet, and mobile widths
  - Loading and error states display properly
  - `npx next build` succeeds

## System-Wide Impact

- **Navigation**: `DmNav` already has `magic` section — no changes needed
- **Database**: New `magic_catalog` table added via `ensureSchema()` — no migration concerns (idempotent DDL)
- **External dependency**: Open5e API is a new external dependency. If it goes down, search won't work but the catalog (cached descriptions) still functions
- **No interaction with other features**: Magic page is self-contained. No impact on sessions, combat, player sheets, or maps

## Risks & Dependencies

- **Open5e API availability**: The page depends on an external API for search. Mitigated by caching descriptions in the catalog — once an item is saved, it's available offline from the DB.
- **Open5e API changes**: v2 API could change. The proxy route normalizes responses, so only the proxy needs updating if the API shape changes.
- **Search result quality**: Open5e search is basic text matching. DM may need to try different name variations. Acceptable for v1.
- **No banner image**: The magic page placeholder doesn't have a banner. May need to use a generic or thematic image, or skip the banner for now.

## Sources & References

- Open5e API v2: `https://api.open5e.com/v2/`
- Related code: `app/dm/magic/page.tsx`, `lib/schema.ts`, `lib/types.ts`, `components/NpcPageClient.tsx`
- Design tokens: `app/globals.css`
