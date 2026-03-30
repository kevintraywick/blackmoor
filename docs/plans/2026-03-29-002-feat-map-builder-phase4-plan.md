---
title: "feat: Map Builder Phase 4 — Asset Placement, Session Link UI, Print Mode"
type: feat
status: active
date: 2026-03-29
origin: docs/brainstorms/2026-03-29-map-builder-requirements.md
---

# Map Builder Phase 4 — Asset Placement, Session Link UI, Print Mode

## Overview

Wire up the remaining Map Builder functionality: asset drag-to-canvas placement from the sidebar palette, a client-side UI for linking levels to sessions, and a basic print mode. Mappy AI re-enablement is deferred (blocked on API credits).

## Problem Frame

The map builder has a working hex grid editor with tile tools (Build, Visible, Obscure), undo/redo, levels, bookmarks, image drop, and a home page. But assets are placeholder emoji buttons with no canvas interaction, session linking has a server API but no UI, and print mode is disabled. These gaps prevent the builder from being usable end-to-end. (see origin: `docs/brainstorms/2026-03-29-map-builder-requirements.md`)

## Requirements Trace

- R12. Built-in primitive assets (wall, door, stairs, water)
- R13. Custom asset uploads to a personal library
- R14. Place assets by selecting from palette, then clicking canvas — snap to hex grid
- R15. Placed assets can be selected, moved, and deleted
- R22. Link level to session for fog-of-war play
- R23. Builder output compatible with existing `maps` table
- R24. Undo/redo for asset actions (system exists, needs asset integration)

## Scope Boundaries

- **Mappy AI deferred** — blocked on Anthropic API key + credits. Image drop continues to use 30x30m defaults.
- **Edge-snap deferred** — overlay positioning works but no auto-snap to canvas edges.
- **No composite image generation** — session linking copies grid data, not a rendered image.
- **Print mode is basic** — renders active+visible tiles to a clean printable view, no pagination or scale controls.
- **Asset rendering is emoji/text-based for built-ins** — no custom SVG sprites yet. Custom uploads render as small images.

## Context & Research

### Relevant Code and Patterns

- **Asset palette sidebar**: `MapBuilderClient.tsx:709-740` — 4 placeholder buttons (drop zone, tree, rock, NPC) in a `w-16` column. No click handlers wired.
- **Asset data model**: `map_build_assets` table with `id, name, category, image_path, is_builtin`. Built-in seeds: Wall, Door, Stairs, Water. API at `/api/map-builder/assets` (GET list, POST create).
- **PlacedAsset type**: `{id, asset_id, col, row}` — already defined in `lib/types.ts:144`.
- **Level assets JSONB**: `map_build_levels.assets` stores `PlacedAsset[]`. PATCH endpoint at `/api/map-builder/[id]/levels/[levelId]` already accepts `{ assets: [...] }`.
- **Session link API**: `POST /api/map-builder/[id]/link` — accepts `{level_id, session_id}`, creates frozen copy in `maps` table. Already maps `visible` tiles to `revealed_tiles`.
- **Sessions API**: `GET /api/sessions` returns session list with `{id, number, title, date}`.
- **Canvas rendering**: `BuilderCanvas.tsx` draws hex grid layers (inactive → active → grid lines → obscured → visible). Assets would be a new layer drawn after grid lines.
- **Undo system**: `useUndoRedo` hook with `push({apply, reverse})` command pattern. Already handles tile actions.
- **DESIGN.md constraints**: No dropdowns — use button groups for session selection. No scrollable sub-containers.

### Institutional Learnings

- **ensureSchema fragility**: DDL with `.catch()` — built-in asset seeding already handles this correctly.
- **Git untracked images**: Check `git status` before referencing new `public/` assets.

## Key Technical Decisions

- **Emoji rendering for built-in assets**: Built-in primitives (wall, door, stairs, water) render as emoji/unicode glyphs drawn into the canvas at hex centers. This avoids image loading complexity and matches the current palette UI. Custom uploaded assets render as `drawImage()` from loaded `HTMLImageElement`.
- **Select tool activates asset interaction**: When Select tool is active, clicking a placed asset selects it (highlight border). Drag moves it (snaps to new hex). Delete/Backspace removes it. When any other tool is active, assets are visual-only.
- **Session link UI as a modal-free panel**: "Link to Session" button opens an inline panel below the toolbar showing available sessions as button group (per DESIGN.md, no dropdown). Select session + confirm to link.
- **Print mode renders to new window**: Print button opens a clean `window.open()` page showing only active+visible tiles on white background — standard browser print dialog. No in-canvas print preview.

## Open Questions

### Resolved During Planning

- **How to render assets on canvas?** → Draw emoji text at hex center for built-ins; `drawImage()` for custom uploads. Keep it simple.
- **Session selection UI?** → Inline panel with button group per DESIGN.md rules.
- **Print approach?** → New window with static canvas render. Browser handles pagination.

### Deferred to Implementation

- Exact emoji/glyph choices for wall, door, stairs, water (may need iteration)
- Asset image preloading strategy for custom uploads (lazy load vs eager)
- Print scale/DPI tuning

## Implementation Units

### Asset Placement

- [ ] **Unit 1: Fetch and display assets in palette**

  **Goal:** Load the asset library from the API and render real asset entries in the sidebar palette instead of hardcoded emoji buttons.

  **Requirements:** R12, R13

  **Dependencies:** None (API and DB already exist)

  **Files:**
  - Modify: `components/MapBuilderClient.tsx`

  **Approach:**
  - On `loadBuild()`, also `fetch('/api/map-builder/assets')` and store in state as `BuilderAsset[]`
  - Replace the 4 hardcoded emoji buttons with a mapped list from the asset library
  - Built-in assets show their category emoji (wall: 🧱, door: 🚪, stairs: 🪜, water: 🌊)
  - Custom assets with `image_path` show a small thumbnail
  - Keep the `+` drop zone button at top for custom asset upload
  - Wire the `+` drop zone: `onDrop` → upload image via `POST /api/map-builder/assets`, add to state
  - Add `selectedAssetId` state — clicking a palette item selects it (gold border highlight)

  **Patterns to follow:**
  - Existing bookmark fetch pattern in `loadBuild()`
  - Existing palette button styling

  **Test scenarios:**
  - Load a build → palette shows 4 built-in assets (Wall, Door, Stairs, Water) + drop zone
  - Click an asset → gold highlight, others deselect
  - Drop an image on `+` → new custom asset appears in palette

  **Verification:**
  - Palette dynamically reflects the asset library from the database

- [ ] **Unit 2: Place assets on canvas by clicking hex tiles**

  **Goal:** With an asset selected in the palette, clicking a hex tile places that asset at the tile's position. Asset renders on the canvas.

  **Requirements:** R14

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `components/MapBuilderClient.tsx`
  - Modify: `components/BuilderCanvas.tsx`

  **Approach:**
  - New prop on `BuilderCanvas`: `placedAssets: PlacedAsset[]` and `assetLibrary: BuilderAsset[]`
  - New render layer in `BuilderCanvas` after grid lines but before obscured/visible overlays: iterate `placedAssets`, look up asset in library, draw emoji or image at `hexCenter(col, row)`
  - In `MapBuilderClient`, when `tool === 'build'` and `selectedAssetId` is set, clicking a tile places the asset instead of toggling the tile. Use a distinct mode: if an asset is selected in the palette, click = place asset; if no asset selected, click = tile toggle (existing behavior)
  - Each placement creates a `PlacedAsset` with `id: crypto.randomUUID()`, appends to level's assets array
  - Autosave the updated assets array via the existing level PATCH endpoint
  - Each placement is an undoable action via `pushUndo()`
  - Preload custom asset images into an `Map<string, HTMLImageElement>` ref when asset library loads

  **Patterns to follow:**
  - Existing tile rendering loop structure in `BuilderCanvas`
  - Existing `handleTileClick` undo pattern

  **Test scenarios:**
  - Select Wall in palette → click a hex → wall emoji appears on that hex
  - Place multiple assets → all render at correct positions
  - Undo → last placed asset removed
  - Switch levels → different assets per level
  - Asset on inactive tile: still visible to DM in editor

  **Verification:**
  - Can place 4+ assets on different tiles and see them all rendered on the canvas

- [ ] **Unit 3: Select, move, and delete placed assets**

  **Goal:** With the Select tool active, clicking a placed asset selects it. Drag to move (re-snaps to hex grid). Delete key removes it.

  **Requirements:** R15

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `components/BuilderCanvas.tsx`
  - Modify: `components/MapBuilderClient.tsx`

  **Approach:**
  - When `tool === 'select'`, clicking on a hex that has a placed asset selects it. Add `onAssetSelect?: (assetPlacementId: string | null) => void` prop to `BuilderCanvas`
  - Hit-testing: on click, check if any `PlacedAsset` occupies the clicked hex (simple col/row match)
  - Selected asset: render a gold highlight border around the hex
  - Drag while selected: update the asset's `col, row` as pointer moves, snapping to hex grid. Ghost preview at new position.
  - On pointer-up after drag: finalize position, push undoable move action
  - Delete/Backspace key while asset selected: remove from array, push undoable delete action
  - Deselect on Escape or clicking empty hex
  - Add `selectedPlacementId` state to `MapBuilderClient`

  **Patterns to follow:**
  - Existing `handlePointerMove` drag logic in `BuilderCanvas`
  - Undo pattern for tile strokes

  **Test scenarios:**
  - Select tool → click asset → gold highlight
  - Drag selected asset to new hex → snaps to hex center
  - Undo move → asset returns to original position
  - Delete key → asset removed; undo → asset restored
  - Click empty hex → deselect

  **Verification:**
  - Full select-move-delete cycle works with undo/redo at each step

### Session Linking UI

- [ ] **Unit 4: Session link panel in editor**

  **Goal:** UI for linking the current level to a session. Shows available sessions as a button group, confirms and calls the existing link API.

  **Requirements:** R22, R23

  **Dependencies:** None (link API already exists)

  **Files:**
  - Modify: `components/MapBuilderClient.tsx`

  **Approach:**
  - Add a "Link to Session" button in the toolbar (near the level tabs area)
  - Clicking it toggles an inline panel below the toolbar (not a modal, not a dropdown)
  - Panel fetches `GET /api/sessions` and displays sessions as a button group: each button shows session number + title
  - DM clicks a session button → confirm inline ("Link Level 1 to Session 5?" with Confirm/Cancel)
  - On confirm → `POST /api/map-builder/{buildId}/link` with `{level_id, session_id}`
  - Show success feedback inline ("Linked to Session 5") then auto-dismiss
  - If level is already linked (need to track `linked_map_id` in level state), show "Update Link" instead, calling the same endpoint
  - Per DESIGN.md: visible buttons, no dropdown, no modal

  **Patterns to follow:**
  - Bookmark bar UI pattern for the inline panel
  - Existing button group styling

  **Test scenarios:**
  - Click "Link to Session" → panel shows available sessions as buttons
  - Select a session → confirmation shown
  - Confirm → API called, success message
  - Cancel → panel closes, no action
  - No sessions exist → helpful message ("No sessions yet")

  **Verification:**
  - Can link a level to a session and see the resulting map in the session's map list

### Print Mode

- [ ] **Unit 5: Basic print mode**

  **Goal:** Print button opens a new window with a clean renderable view of the active+visible tiles for browser printing.

  **Requirements:** Implied by Print tool button (currently disabled)

  **Dependencies:** None

  **Files:**
  - Modify: `components/MapBuilderClient.tsx`

  **Approach:**
  - Enable the Print button (remove `disabled` and `cursor-not-allowed`)
  - On click: create a new canvas in memory, render only active+visible tiles on white background with clean grid lines (no UI chrome, no toolbar, no sidebar)
  - Open `window.open()` with the canvas as a `<img>` (via `canvas.toDataURL()`), trigger `window.print()`
  - Render at a fixed scale suitable for printing (e.g., 20px per hex radius)
  - Only render the bounding box of active tiles (crop empty space)
  - Include level name as a header in the print page
  - Clean, minimal styling — black grid lines on white, filled hexes in light blue

  **Patterns to follow:**
  - Existing `BuilderCanvas` render logic (extract the drawing code into a reusable function or call it with a different canvas/context)

  **Test scenarios:**
  - Click Print → new window opens with map render
  - Only active+visible tiles shown (inactive tiles excluded)
  - Browser print dialog appears
  - Empty map → graceful handling (nothing to print message)

  **Verification:**
  - Can print a map section to PDF via browser print dialog

## System-Wide Impact

- **BuilderCanvas props**: New `placedAssets` and `assetLibrary` props, new `onAssetSelect` callback. No impact on existing rendering.
- **Session link**: Calls existing `/api/map-builder/[id]/link` endpoint and `GET /api/sessions`. No schema changes.
- **Print**: Self-contained — opens a new window, no impact on existing pages.
- **No new API routes** — all needed endpoints already exist.
- **No schema changes** — all tables and columns are already in place.

## Risks & Dependencies

- **Asset rendering performance**: Drawing emoji text via `ctx.fillText()` for each placed asset adds draw calls. Should be negligible for typical map asset counts (<100), but monitor if DMs place many assets.
- **Custom asset image loading**: Need to preload images before they can be `drawImage()`'d. If images are large or numerous, could delay initial render. Use lazy loading and skip unloaded images gracefully.
- **Print quality**: Canvas `toDataURL()` is raster. For high-quality printing, may need SVG export later — but browser-print-from-canvas is sufficient for a first pass.
- **Session list could be long**: If many sessions exist, the button group could overflow. Since DESIGN.md forbids scrollable containers and dropdowns, may need pagination or a "recent sessions" limit.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-29-map-builder-requirements.md](../brainstorms/2026-03-29-map-builder-requirements.md)
- **Phase 1-3 plan:** [docs/plans/2026-03-29-001-feat-map-builder-plan.md](2026-03-29-001-feat-map-builder-plan.md)
- **Existing asset API:** `app/api/map-builder/assets/route.ts`
- **Session link API:** `app/api/map-builder/[id]/link/route.ts`
- **Canvas component:** `components/BuilderCanvas.tsx`
- **Design constraints:** DESIGN.md (no dropdowns, no scrollable containers, visible controls)
