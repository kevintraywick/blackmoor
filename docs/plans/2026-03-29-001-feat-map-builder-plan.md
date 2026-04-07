---
title: "feat: Map Builder — hex grid editor with AI image import"
type: feat
status: active
date: 2026-03-29
origin: docs/brainstorms/2026-03-29-map-builder-requirements.md
---

# Map Builder — Hex Grid Editor with AI Image Import

## Overview

A standalone DM prep tool at `/dm/map-builder` for composing hex-grid maps from scratch, from dropped images (analyzed by "Mappy" via Claude Vision), and from an asset library. Output feeds into the existing session map system as frozen snapshots for fog-of-war play.

## Problem Frame

The existing map system is a session-scoped viewer — upload an image, overlay a grid, reveal tiles. The DM has no way to *build* maps: no tile activation, no asset placement, no image composition, no multi-level support. Map prep happens outside the app entirely. (see origin: `docs/brainstorms/2026-03-29-map-builder-requirements.md`)

## Requirements Trace

- R1. 50m x 50m hex grid (100x100 tiles, 0.5m each) — prototype canvas
- R2. Flat-top hex orientation
- R3. Click to activate/deactivate tiles (visible to players)
- R4. Brush: click-drag to paint-activate tile strokes
- R5. Zoom (scroll wheel at cursor) + pan (drag)
- R6. Inactive tiles visible at reduced opacity
- R7-R8. Named bookmarks, persistent to DB
- R9-R11. Named levels (logical groupings), each with own tiles/assets/images
- R12-R15. Asset library: built-in primitives + custom uploads, snap to grid, selectable/movable/deletable
- R16-R21. Image drop → Mappy estimates size → draggable overlay → edge-snap → commit/cancel
- R22-R23. Link level to session as frozen snapshot
- R24. Undo/redo (Ctrl+Z / Cmd+Z), per-action, in-memory

## Scope Boundaries

- Not replacing the existing session map page
- No real-time collaboration (single-DM prep tool)
- No token/character placement
- No procedural generation (Mappy interprets, doesn't generate)
- No print layout
- Prototype canvas is 50m x 50m; larger canvases deferred
- Undo stack is in-memory only (lost on reload), capped at 100 actions

## Context & Research

### Relevant Code and Patterns

- **Hex math**: `components/MapCanvas.tsx` — flat-top even-q offset, `hexCenter()`, `hexPath()`, `pixelToTile()` with cube rounding. Reuse this math directly.
- **Page pattern**: Server `page.tsx` (force-dynamic, ensureSchema, fetch data) + `'use client'` component. Every DM page follows this.
- **API routes**: REST route handlers under `app/api/`. Async params pattern for Next.js 16: `{ params }: { params: Promise<{ id: string }> }`.
- **Image upload**: `app/api/maps/[id]/image/route.ts` — FormData, validate MIME, write to `MAPS_DIR`, filename in DB. Reuse this pattern.
- **Schema migration**: `ensureSchema()` with `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`. DDL must use `.catch()` for constraints (see memory: ensureSchema fragility).
- **Autosave**: `lib/useAutosave.ts` — debounced PATCH with merged field patches.
- **SSE broadcasts**: `lib/events.ts` + `lib/useSSE.ts` — not needed for builder (single-user), but session maps use this.
- **Installed but unused**: `@react-three/fiber`, `three`, `@dnd-kit/core` — available if needed.
- **Nav**: `components/DmNav.tsx` — add `map-builder` to `NavSection` type and `LINKS` array.
- **Design tokens**: `app/globals.css` — warm browns, gold accent, EB Garamond serif, Geist sans.

### External Research Findings

**Canvas 2D performance (10K hexes):**
- 10,000 hexagons is well within Canvas 2D's comfort zone. With viewport culling, only ~1,000-2,000 hexes are visible at typical zoom → 2-5ms per frame.
- Key optimizations: viewport culling (biggest win), batch draws by fill color, offscreen canvas for static terrain layer, `requestAnimationFrame` with dirty flag.
- WebGL/Three.js not needed at this scale. Canvas 2D with `setTransform` for camera is sufficient.
- Camera pattern: maintain `{x, y, zoom}`, apply via `ctx.setTransform(zoom, 0, 0, zoom, x*zoom, y*zoom)` before drawing. Zoom-at-cursor math adjusts offset so world point under cursor stays fixed.

**Claude Vision API (Mappy):**
- Package: `@anthropic-ai/sdk`. Model: `claude-sonnet-4-20250514`.
- Use tool_use with `tool_choice: { type: "tool", name: "report_map_dimensions" }` for guaranteed structured JSON output.
- Cost: ~$0.007 per call (under 1 cent). Negligible for prep frequency.
- Prompt should prioritize grid counting (most accurate), then doors/corridors as scale anchors.
- Fallback chain: high confidence → use as-is; medium → show with adjustment UI; low → foreground manual input; API failure → manual input only.

**Tile storage:**
- Sparse `Map<number, TileData>` with packed integer keys (`col * 10000 + row`) for client-side state.
- DB: compressed JSONB object (sparse map of `"col,row": tileType`) rather than array of tuples. Efficient for partial updates and 10K scale.

## Key Technical Decisions

- **Canvas 2D, not WebGL**: 10K hexes with viewport culling renders in 2-5ms. No need for Three.js complexity. (see origin)
- **Visible tool palette**: Paint (activate tiles), Select (assets), Pan. Consistent with DESIGN.md — all controls visible, no hidden modes. Image overlay auto-enters drag mode.
- **Frozen copy for session linking**: Linking exports a snapshot to the `maps` table. Builder edits don't propagate until DM explicitly "pushes update." No mid-game surprises.
- **New `map_builds` table**: Separate from `maps` to avoid polluting the session system. Builder data (levels, tiles, assets, bookmarks) lives here. Session linking copies relevant data into `maps`.
- **Sparse JSONB for tile state**: `tiles JSONB DEFAULT '{}'` — keys are `"col,row"`, values are tile state objects. Only active/modified tiles are stored. Keeps payloads small for partial grids.
- **Mappy uses Claude Sonnet via tool_use**: Structured output guaranteed. ~$0.007/call. Server-side only — API key never exposed to client.
- **In-memory undo stack, 100 actions**: Undo history not persisted. Autosave preserves latest state. Bookmark restore is an undoable action.
- **One overlay at a time**: Dropping a second image requires committing or canceling the first.
- **Assets on deactivated tiles become hidden but not deleted**: Reactivating the tile reveals the asset again.

## Open Questions

### Resolved During Planning

- **Canvas 2D vs WebGL?** → Canvas 2D. Research confirms 10K hexes with culling is 2-5ms/frame.
- **Storage model?** → Sparse JSONB object per level. Efficient at 10K scale, simple to query.
- **Mode switching?** → Visible tool palette (Paint/Select/Pan). Matches DESIGN.md principles.
- **Session link type?** → Frozen copy with "Push Update" action.
- **Undo depth?** → 100 actions, in-memory only.
- **Multiple overlays?** → One at a time.
- **Bookmark scope?** → Full snapshot of all levels (tiles + assets + images). Restore is undoable.

### Deferred to Implementation

- Exact hex-to-pixel scaling factor for 0.5m tiles at default zoom
- Mappy prompt tuning (iterative based on real image results)
- Edge-snap threshold distance (needs feel-testing in the canvas)
- Asset sprite rendering approach (draw into canvas vs. overlay elements) — prototype both

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─────────────────────────────────────────────────────┐
│  /dm/map-builder (page.tsx)                         │
│  ┌───────────────────────────────────────────────┐  │
│  │ MapBuilderClient.tsx                          │  │
│  │  ┌─────────┐  ┌───────────────────────────┐   │  │
│  │  │ Toolbar  │  │ BuilderCanvas             │   │  │
│  │  │ ──────── │  │  - Camera (zoom/pan)      │   │  │
│  │  │ Paint    │  │  - Hex grid renderer      │   │  │
│  │  │ Select   │  │  - Tile activation layer  │   │  │
│  │  │ Pan      │  │  - Asset layer            │   │  │
│  │  │ ──────── │  │  - Image overlay layer    │   │  │
│  │  │ Assets   │  │  - Viewport culling       │   │  │
│  │  │ palette  │  │  - Offscreen caching      │   │  │
│  │  └─────────┘  └───────────────────────────┘   │  │
│  │  ┌─────────────────────────────────────────┐   │  │
│  │  │ Level tabs │ Bookmarks │ Image drop zone│   │  │
│  │  └─────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  API Routes:                                        │
│  POST/GET/PATCH/DELETE /api/map-builder              │
│  POST /api/map-builder/[id]/image     (upload)      │
│  POST /api/map-builder/[id]/mappy     (AI analyze)  │
│  POST /api/map-builder/[id]/link      (→ session)   │
│  POST /api/map-builder/assets         (custom upload)│
│  GET  /api/map-builder/assets         (library)     │
└─────────────────────────────────────────────────────┘

Data Model:
  map_builds (id, name, created_at, updated_at)
    └── map_build_levels (id, build_id, name, sort_order,
    │       cols, rows, tiles JSONB, assets JSONB, images JSONB)
    └── map_build_bookmarks (id, build_id, name, snapshot JSONB,
    │       created_at)
    └── map_build_assets (id, name, category, image_path,
            is_builtin, created_at)  ← shared library

Session linking:
  map_build_levels → (frozen copy) → maps table
  (copies grid dimensions, tiles→revealed_tiles, image composite)
```

## Implementation Units

### Phase 1: Canvas Foundation

- [ ] **Unit 1: Data model and schema**

  **Goal:** Create the `map_builds`, `map_build_levels`, `map_build_bookmarks`, and `map_build_assets` tables.

  **Requirements:** R1, R7-R8, R9-R11, R13

  **Dependencies:** None

  **Files:**
  - Modify: `lib/schema.ts`
  - Modify: `lib/types.ts`

  **Approach:**
  - Add table creation to `ensureSchema()` with `CREATE TABLE IF NOT EXISTS`
  - `map_build_levels.tiles` is sparse JSONB: `{"col,row": {"active": true}}` — only stores modified tiles
  - `map_build_levels.assets` is JSONB array: `[{id, asset_id, col, row}]`
  - `map_build_levels.images` is JSONB array: `[{id, image_path, x, y, width, height}]` — committed image layers
  - `map_build_bookmarks.snapshot` stores full state of all levels as JSONB
  - `map_build_assets` has `is_builtin BOOLEAN` flag; seed built-in primitives (wall, door, stairs, water)
  - Use `.catch()` on any index creation per ensureSchema fragility rules

  **Patterns to follow:**
  - Existing `campaign` table creation pattern in `schema.ts`
  - JSONB patterns from `magic_catalog.metadata`, `sessions.menagerie`

  **Test scenarios:**
  - Schema creates all tables on first load without errors
  - Idempotent: calling ensureSchema twice doesn't fail
  - Built-in assets seeded exactly once

  **Verification:**
  - Tables exist in DB after server start
  - Types compile without errors

- [ ] **Unit 2: API routes — CRUD for map builds, levels, and assets**

  **Goal:** REST endpoints for creating/reading/updating/deleting map builds, managing levels within a build, and the asset library.

  **Requirements:** R1, R9-R11, R12-R13

  **Dependencies:** Unit 1

  **Files:**
  - Create: `app/api/map-builder/route.ts` (GET list, POST create)
  - Create: `app/api/map-builder/[id]/route.ts` (GET, PATCH, DELETE)
  - Create: `app/api/map-builder/[id]/levels/route.ts` (GET, POST)
  - Create: `app/api/map-builder/[id]/levels/[levelId]/route.ts` (PATCH tiles/assets/images, DELETE)
  - Create: `app/api/map-builder/assets/route.ts` (GET library, POST upload custom)

  **Approach:**
  - Follow existing route handler patterns: `ensureSchema()`, `query<T>()`, `NextResponse.json()`
  - Level PATCH accepts partial updates: `{ tiles: {...}, assets: [...], images: [...] }` — merges into existing JSONB
  - Asset upload reuses the image upload pattern from `/api/maps/[id]/image` but stores in a separate `ASSETS_DIR`
  - Input validation: name length limits, category allowlist for assets

  **Patterns to follow:**
  - `app/api/magic/catalog/route.ts` for CRUD with JSONB
  - `app/api/maps/[id]/image/route.ts` for file upload
  - Next.js 16 async params: `{ params }: { params: Promise<{ id: string }> }`

  **Test scenarios:**
  - Create a build, add levels, update tile state, retrieve
  - Upload custom asset, list library (includes built-ins)
  - Delete a level, verify cascade
  - Invalid inputs rejected with 400

  **Verification:**
  - All CRUD operations work via curl/fetch
  - JSONB merging preserves existing tiles when updating a subset

- [ ] **Unit 3: Page shell and nav entry**

  **Goal:** Create the `/dm/map-builder` page with DmNav integration and a basic client component shell.

  **Requirements:** R1, R2

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Create: `app/dm/map-builder/page.tsx`
  - Create: `components/MapBuilderClient.tsx`
  - Modify: `components/DmNav.tsx` (add `map-builder` to NavSection and LINKS)

  **Approach:**
  - Server page: `force-dynamic`, `ensureSchema()`, fetch builds list, pass to client component
  - Client component: initially renders build selector + empty canvas area
  - DmNav: add between Maps and Magic in the link order
  - Follow `max-w-[1000px]` for chrome, but canvas itself can be full-width

  **Patterns to follow:**
  - `app/dm/magic/page.tsx` + `components/MagicPageClient.tsx`

  **Test scenarios:**
  - Page loads without errors
  - Nav shows "Map Builder" link, highlights when active

  **Verification:**
  - Navigate to `/dm/map-builder`, see the page shell with DmNav

- [ ] **Unit 4: Hex canvas with zoom, pan, and viewport culling**

  **Goal:** A Canvas 2D component that renders a 100x100 flat-top hex grid with camera controls (scroll-to-zoom at cursor, drag-to-pan) and viewport culling.

  **Requirements:** R1, R2, R5, R6

  **Dependencies:** Unit 3

  **Files:**
  - Create: `components/BuilderCanvas.tsx`
  - Create: `lib/hex-math.ts` (extract reusable hex functions from MapCanvas.tsx)

  **Approach:**
  - Extract hex math from `MapCanvas.tsx` into `lib/hex-math.ts`: `hexCenter()`, `hexPath()`, `pixelToTile()`, `hexCorners()`. Both MapCanvas and BuilderCanvas import from there.
  - Camera state: `{x, y, zoom}` applied via `ctx.setTransform()` before all drawing
  - Zoom: scroll wheel → adjust zoom, recalculate offset so world point under cursor stays fixed. Clamp zoom to min/max range.
  - Pan: pointer-down on empty space (when Pan tool active or middle-click) → track delta, update camera offset
  - Viewport culling: convert canvas bounds to hex coordinate range using inverse camera transform. Only draw hexes within that range.
  - Rendering layers (single canvas, draw order): background color → inactive hex fills (low opacity) → active hex fills → grid lines → assets → overlay
  - Batch hex draws by fill color (active vs inactive) into single `Path2D` per color
  - Use `requestAnimationFrame` with dirty flag — only redraw when state changes
  - Offscreen canvas for static hex grid layer; re-render only on tile state change, blit on pan/zoom

  **Patterns to follow:**
  - `components/MapCanvas.tsx` for canvas setup, event handling, hex rendering
  - Red Blob Games flat-top hex coordinate reference

  **Test scenarios:**
  - 100x100 grid renders without lag
  - Scroll zoom centers on cursor position
  - Pan moves the viewport smoothly
  - Only visible hexes are drawn (verify with a draw counter)
  - Grid renders correctly at extreme zoom in/out

  **Verification:**
  - Smooth 60fps interaction when zooming and panning across the full grid
  - Dev console shows <2000 hexes drawn per frame at normal zoom

### Phase 2: Core Editing

- [ ] **Unit 5: Tool palette and tile activation**

  **Goal:** Visible tool palette (Activate, Select, Pan) and click/drag tile activation on the canvas.

  **Requirements:** R3, R4, R6

  **Dependencies:** Unit 4

  **Files:**
  - Modify: `components/MapBuilderClient.tsx`
  - Modify: `components/BuilderCanvas.tsx`

  **Approach:**
  - Tool palette: visible row of tool buttons at top or left of canvas. Active tool highlighted. Keyboard shortcuts (A=activate, S=select, P=pan, Escape=deselect).
  - Activate tool: click tile → toggle active/inactive. Click-drag → paint stroke (always activates, like existing MapCanvas drag-reveal). Right-click-drag or shift-click-drag → deactivate stroke.
  - Active tiles: full opacity fill. Inactive tiles: low opacity fill (R6).
  - Tile state stored in a `Map<number, TileState>` with packed keys. Autosave debounced PATCH to API.
  - Each tile activation/deactivation is an undo-able action.

  **Patterns to follow:**
  - Existing MapCanvas click/drag handler pattern
  - `useAutosave` for debounced persistence

  **Test scenarios:**
  - Click activates a tile, click again deactivates
  - Drag paints a stroke of active tiles
  - Tool switching works via buttons and keyboard shortcuts
  - Active/inactive tiles visually distinct

  **Verification:**
  - Can activate a room-shaped region of tiles and see them at full opacity

- [ ] **Unit 6: Undo/redo system**

  **Goal:** In-memory undo/redo stack for all builder actions. Ctrl+Z/Cmd+Z to undo, Ctrl+Shift+Z/Cmd+Shift+Z to redo.

  **Requirements:** R24

  **Dependencies:** Unit 5

  **Files:**
  - Create: `lib/useUndoRedo.ts`
  - Modify: `components/MapBuilderClient.tsx`

  **Approach:**
  - Custom hook: `useUndoRedo<T>()` — maintains a stack of action objects, each with `apply()` and `reverse()` methods (command pattern).
  - Actions: tile toggle, tile paint stroke (batch), asset place, asset move, asset delete, bookmark restore, image commit.
  - Stack capped at 100 entries. New actions clear the redo stack.
  - Keyboard event listener on the builder container for Ctrl+Z / Cmd+Z.
  - Paint strokes batch all tiles in a single drag into one undo action.

  **Patterns to follow:**
  - Standard command pattern for undo/redo

  **Test scenarios:**
  - Activate 5 tiles, undo → all 5 deactivate (single undo for drag stroke)
  - Undo then redo restores the tiles
  - 101st action drops the oldest from the stack
  - Redo stack clears on new action after undo

  **Verification:**
  - Can undo/redo 20 consecutive actions without state corruption

- [ ] **Unit 7: Level management**

  **Goal:** Named levels within a map build. Tabs to switch, create, rename, delete levels.

  **Requirements:** R9, R10, R11

  **Dependencies:** Unit 5

  **Files:**
  - Modify: `components/MapBuilderClient.tsx`

  **Approach:**
  - Level tabs below the toolbar. Active level highlighted. "+ New Level" button creates a level with a default name.
  - Inline rename (click level name to edit, blur to save).
  - Each level has independent tile state, assets, and images.
  - Switching levels swaps the canvas data source and resets the viewport.
  - First level created automatically with the build ("Level 1").
  - Delete level: confirmation prompt (not a modal — inline confirmation like NPC delete).

  **Patterns to follow:**
  - Session tab selector in `DmSessionsClient.tsx`
  - Inline rename pattern from NPC name editing

  **Test scenarios:**
  - Create a build → one level exists by default
  - Add a second level, switch between them, verify independent tile state
  - Rename a level, verify persistence
  - Delete a level, verify data removed

  **Verification:**
  - Three levels with different active tiles, switching preserves each correctly

### Phase 3: Image Drop + Mappy

- [ ] **Unit 8: Image drop zone and upload**

  **Goal:** DM can drop an image onto the canvas. Image uploads to the server and returns a URL.

  **Requirements:** R16

  **Dependencies:** Unit 4

  **Files:**
  - Modify: `components/BuilderCanvas.tsx` (drop zone events)
  - Create: `app/api/map-builder/[id]/image/route.ts`

  **Approach:**
  - Canvas element acts as a drop zone. `onDragOver` + `onDrop` events.
  - On drop: upload image to server via FormData (reuse existing image upload pattern, but store in `BUILDER_IMAGES_DIR`).
  - Server validates MIME (PNG/JPEG/WEBP), size (<20MB), writes to disk, returns image path.
  - Client receives path and triggers Mappy analysis (Unit 9).
  - Visual feedback during drag-over (border highlight) and upload (loading indicator).

  **Patterns to follow:**
  - `app/api/maps/[id]/image/route.ts` for upload handling

  **Test scenarios:**
  - Drop a PNG → uploads successfully, returns path
  - Drop a non-image file → rejected with error message
  - Drop a >20MB file → rejected
  - Visual feedback during drag-over

  **Verification:**
  - Dropped image file appears in `BUILDER_IMAGES_DIR` on server

- [ ] **Unit 9: Mappy — AI image analysis**

  **Goal:** Server-side Claude Vision integration that analyzes a dropped map image and estimates its real-world dimensions.

  **Requirements:** R17

  **Dependencies:** Unit 8

  **Files:**
  - Create: `app/api/map-builder/[id]/mappy/route.ts`
  - Create: `lib/mappy.ts` (Claude Vision API call logic)

  **Approach:**
  - `lib/mappy.ts`: takes an image path, reads the file, sends to Claude Sonnet via `@anthropic-ai/sdk` with tool_use for structured output.
  - Tool schema: `report_map_dimensions` with `width_meters`, `height_meters`, `confidence`, `method`, `notes`.
  - Prompt prioritizes grid counting, then doors/corridors as scale anchors.
  - API route: POST with `{image_path}` → calls mappy → returns `{width_meters, height_meters, confidence, method, notes}`.
  - Fallback chain: API error or low confidence → return estimate with `confidence: "low"`, client shows manual input prominently.
  - Requires `ANTHROPIC_API_KEY` env var. Check at call time, return 500 with clear message if missing.

  **Patterns to follow:**
  - Anthropic SDK tool_use with `tool_choice` for forced structured output

  **Test scenarios:**
  - Image with visible grid → high confidence, accurate dimensions
  - Abstract image → low confidence, reasonable fallback
  - API key missing → clear error message
  - API timeout → graceful degradation to manual input

  **Verification:**
  - Drop a battle map image → Mappy returns reasonable meter estimates

- [ ] **Unit 10: Draggable overlay, edge-snap, and commit**

  **Goal:** After Mappy analysis, the image becomes a draggable overlay on the canvas. DM adjusts size, repositions, commits or cancels.

  **Requirements:** R17 (modifiable estimate), R18, R19, R20, R21

  **Dependencies:** Unit 8, Unit 9, Unit 6

  **Files:**
  - Modify: `components/BuilderCanvas.tsx`
  - Modify: `components/MapBuilderClient.tsx`

  **Approach:**
  - After Mappy returns, show a size adjustment panel: width/height in meters with input fields, pre-filled with Mappy's estimate. DM can adjust.
  - Image renders as a semi-transparent overlay on the canvas, positioned at center initially.
  - Auto-enters drag mode: DM drags the overlay to reposition. Canvas tools are disabled while overlay is active.
  - Edge-snap: when overlay's edge is within N pixels of canvas boundary, snap to align and show a visual indicator (highlighted edge, "extend canvas" label).
  - Commit button: applies the overlay. If edge-snapped, expands grid dimensions first. Image data saved to level's `images` JSONB. Tiles under the image optionally auto-activate.
  - Cancel button: discards the overlay entirely.
  - Commit and cancel are both undoable actions.
  - Only one overlay at a time. If DM drops another image, prompt to commit/cancel first.

  **Patterns to follow:**
  - Overlay drag is pure canvas rendering + pointer events, similar to existing MapCanvas interaction

  **Test scenarios:**
  - Drop image → see size estimate → adjust → overlay appears on canvas
  - Drag overlay to center of map → commit → image layer saved
  - Drag overlay to east edge → snap → commit → canvas extends eastward
  - Cancel → overlay removed, no state change
  - Drop second image while first overlay active → prompt to commit/cancel first
  - Undo after commit → image layer removed

  **Verification:**
  - Complete flow: drop → estimate → adjust → position → commit → image visible on canvas as permanent layer

### Phase 4: Assets and Session Integration

- [ ] **Unit 11: Asset palette and placement**

  **Goal:** Visible asset palette with built-in primitives and custom uploads. Place, select, move, delete assets on the hex grid.

  **Requirements:** R12, R13, R14, R15

  **Dependencies:** Unit 5, Unit 6

  **Files:**
  - Modify: `components/MapBuilderClient.tsx`
  - Modify: `components/BuilderCanvas.tsx`

  **Approach:**
  - Asset palette: visible panel (left side or bottom) showing available assets as icons. Built-in primitives rendered as simple SVG/canvas icons. Custom assets show uploaded image thumbnails.
  - Placement: select asset from palette → click canvas tile → asset placed at that hex, snapped to center. Ghost preview shown while hovering.
  - Select tool: click a placed asset → selection handles appear. Drag to move (re-snaps to grid). Delete key or X button removes.
  - Assets stored in level's `assets` JSONB: `[{id, asset_id, col, row}]`.
  - Upload custom: button in palette opens file input (not a modal — inline). Accepted formats: PNG, SVG, WEBP. Size limit: 2MB.
  - Assets on deactivated tiles: hidden but not deleted. Reactivating the tile reveals them.
  - Each place/move/delete is an undoable action.

  **Patterns to follow:**
  - Magic catalog category buttons for palette layout
  - Asset rendering: draw pre-loaded images into canvas at hex centers

  **Test scenarios:**
  - Place a wall asset on a tile → visible on canvas
  - Select and move the asset → re-snaps to new hex
  - Delete the asset → removed from canvas and state
  - Upload a custom asset → appears in palette for reuse
  - Deactivate tile with asset → asset hidden; reactivate → asset reappears

  **Verification:**
  - Can annotate a room with walls and doors, then select/reposition them

- [ ] **Unit 12: Bookmarks**

  **Goal:** Named bookmarks that snapshot the full build state. Persistent to DB. Restore is undoable.

  **Requirements:** R7, R8

  **Dependencies:** Unit 5, Unit 6, Unit 7

  **Files:**
  - Modify: `components/MapBuilderClient.tsx`
  - Create: `app/api/map-builder/[id]/bookmarks/route.ts` (GET, POST)
  - Create: `app/api/map-builder/[id]/bookmarks/[bookmarkId]/route.ts` (DELETE)

  **Approach:**
  - Bookmark panel: visible list below level tabs or in a sidebar section. Each bookmark shows name and creation time.
  - "Save Bookmark" button → inline name input → POST snapshot to API.
  - Snapshot captures: all levels with their tiles, assets, and images. Stored as JSONB in `map_build_bookmarks.snapshot`.
  - Clicking a bookmark → restores that state (replaces current). This is an undoable action (previous state pushed to undo stack).
  - Delete bookmark: inline confirmation.
  - Snapshot size concern: at 10K tiles × N levels, snapshots could be large. Mitigate by only storing sparse tile data (only active tiles).

  **Patterns to follow:**
  - Session selector pattern for bookmark list
  - Bookmark restore as an undoable command

  **Test scenarios:**
  - Create bookmark → appears in list
  - Modify tiles → restore bookmark → tiles revert
  - Undo after restore → returns to modified state
  - Delete bookmark → removed from list

  **Verification:**
  - Bookmark round-trip: save → modify → restore → state matches saved

- [ ] **Unit 13: Session linking (frozen copy)**

  **Goal:** Link a builder level to a session as a frozen snapshot in the existing `maps` table.

  **Requirements:** R22, R23

  **Dependencies:** Unit 7, Unit 2

  **Files:**
  - Create: `app/api/map-builder/[id]/link/route.ts`
  - Modify: `components/MapBuilderClient.tsx` (link UI)

  **Approach:**
  - "Link to Session" button per level. Shows available sessions (fetched from existing sessions API).
  - On link: server creates a new row in `maps` table with:
    - `session_id` from selected session
    - `grid_type: 'hex'`, `hex_orientation: 'flat'`
    - `cols`, `rows` from the level
    - `tile_px` calculated from 0.5m hex size
    - `revealed_tiles: []` (fog starts fully hidden; DM reveals during play)
    - `image_path`: composite image of committed image layers (or the first image layer)
    - `name`: level name
  - Builder level stores `linked_map_id` reference for "Push Update" later.
  - "Push Update" button: re-copies current level state to the linked map row.
  - Session selector: visible list of sessions (radio buttons or button group, not dropdown per DESIGN.md).

  **Patterns to follow:**
  - `app/api/maps/route.ts` POST for creating map rows
  - Session list fetching pattern

  **Test scenarios:**
  - Link a level to a session → map appears in session's map list
  - Fog starts fully hidden in the linked map
  - Edit level in builder → session map unchanged until "Push Update"
  - Push Update → session map reflects builder changes

  **Verification:**
  - Linked map is playable in existing session map system with fog-of-war

## System-Wide Impact

- **Schema**: 4 new tables in `ensureSchema()`. No changes to existing tables.
- **Nav**: One new entry in `DmNav.tsx`. No impact on existing pages.
- **Image storage**: New directory (`BUILDER_IMAGES_DIR` / `ASSETS_DIR`) alongside existing `MAPS_DIR`.
- **API surface**: New route tree under `/api/map-builder/`. No changes to existing `/api/maps/` routes.
- **Session map system**: Only touched by the linking action (Unit 13), which creates standard `maps` rows. Existing fog-of-war, DM notes, and player views work unchanged.
- **New dependency**: `@anthropic-ai/sdk` for Mappy. Requires `ANTHROPIC_API_KEY` env var in Railway.
- **Bundle size**: BuilderCanvas is a new client component. Canvas 2D has no library dependencies. The Anthropic SDK is server-side only.

## Risks & Dependencies

- **Anthropic API key**: Must be set in Railway env vars before Mappy works. Builder should function fully without it (manual image sizing only).
- **Canvas performance**: Prototype at 100x100 should be fine per research. Risk increases if DMs want larger canvases — viewport culling and offscreen caching must be solid from the start.
- **Bookmark storage**: Full snapshots of large maps could produce large JSONB blobs. Monitor row sizes. Consider compression (LZ-string) if snapshots exceed 1MB.
- **Image compositing for session linking**: Creating a single composite image from multiple overlapping image layers is non-trivial. May need server-side canvas (node-canvas or sharp) or simply link the first/primary image layer.
- **Next.js 16 breaking changes**: Per AGENTS.md, must consult `node_modules/next/dist/docs/` before writing any route handler or page component.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-29-map-builder-requirements.md](../brainstorms/2026-03-29-map-builder-requirements.md)
- **Existing hex math:** `components/MapCanvas.tsx` — `hexCenter()`, `hexPath()`, `pixelToTile()`
- **Existing image upload:** `app/api/maps/[id]/image/route.ts`
- **Red Blob Games hex reference:** redblobgames.com/grids/hexagons/
- **Canvas 2D performance research:** 10K hexes confirmed feasible with viewport culling + color batching
- **Anthropic Vision API:** tool_use with forced tool_choice for structured output, ~$0.007/call
- **Design constraints:** DESIGN.md (no dropdowns, no hidden controls, 1000px max-width, immediate understanding)
