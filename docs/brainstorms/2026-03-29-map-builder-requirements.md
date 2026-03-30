---
date: 2026-03-29
topic: map-builder
---

# Map Builder

## Problem Frame

The DM needs a way to build maps from scratch and from images *before* a session — assembling rooms, corridors, terrain, and assets into a hex-grid world that can then be linked to sessions for live fog-of-war play. The existing map system is a session-scoped viewer (upload image, overlay grid, reveal tiles). It has no building tools, no asset placement, and no way to compose maps from multiple sources.

The builder is a **standalone prep tool** (separate from the session map page). Its output — a completed map — feeds into the existing session map system where fog-of-war, DM notes, and live player views already work.

## Requirements

### Canvas & Grid

- R1. Default canvas is 50m x 50m hex grid (prototype). Each hex tile is 0.5m across. This yields ~100x100 = 10,000 tiles.
- R2. Hex grid uses flat-top orientation (consistent with existing MapCanvas).
- R3. All tiles start greyed out / inactive. DM clicks a tile to make it "active" (visible to players and in print). Click again to deactivate.
- R4. DM can paint-activate tiles with a brush (click-drag to activate/deactivate a stroke of tiles), not only one at a time.
- R5. Canvas supports zoom (scroll wheel, centered on cursor) and pan (click-drag on empty space or middle-click drag). Zoom and pan must be frictionless — no modifier keys required.
- R6. Inactive tiles remain visible to the DM at reduced opacity. Zooming shows both active and inactive tiles.

### Bookmarks

- R7. DM can bookmark the current map state with a name. Bookmarks appear in a list. Clicking a bookmark restores that named view/state.
- R8. Bookmarks are persistent (saved to DB), not just in-memory.

### Levels (Logical Groupings)

- R9. A map can have multiple named levels (e.g., "Tavern Ground Floor," "Cave System," "Tower Top"). Levels are logical labels, not spatially stacked.
- R10. DM switches between levels via tabs or a level selector. Default level is whichever the DM is currently working on.
- R11. Each level has its own set of tiles, assets, and image layers.

### Asset Library

- R12. Built-in primitive assets: walls, doors, stairs, water. Enough to annotate and connect rooms.
- R13. DM can upload custom assets (furniture, traps, terrain features) that are saved to a personal asset library for reuse across maps.
- R14. Assets are placed by selecting from a visible palette, then clicking/dragging onto the canvas. Assets snap to hex grid by default.
- R15. Placed assets can be selected, moved, and deleted. (Avoid Dungeondraft's "painted on, can't modify later" problem.)

### Image Drop + Mappy (AI Agent)

- R16. DM drops an image (hand-drawn sketch, AI-generated battle map, or pre-made map asset) onto a drop zone or directly onto the canvas.
- R17. "Mappy" (AI agent) analyzes the image and estimates its real-world size in meters. The estimate is shown to the DM and is **modifiable** — DM can adjust width/height before placing.
- R18. The dropped image always starts as a **draggable overlay** on the current level. DM can reposition it freely over the existing map.
- R19. **Edge snapping**: When the DM drags the overlay near a canvas edge, it soft-snaps into alignment. This signals a "map extension" — committing will expand the canvas and add the new area.
- R20. **Commit**: DM commits the overlay. New image tiles replace existing tiles in the committed area. For edge-snap commits, the canvas grows to accommodate the extension.
- R21. Before commit, the DM can cancel and discard the overlay.

### Session Integration

- R22. A completed map (or individual level) can be linked to a session, making it available in the existing session map system with fog-of-war, DM notes, and player views.
- R23. The builder output must be compatible with the existing `maps` table schema or extend it cleanly.

### Undo

- R24. Ctrl+Z / Cmd+Z undoes the last action. Ctrl+Shift+Z / Cmd+Shift+Z redoes. Granular per-action, not per-session.

## Success Criteria

- A DM can open the builder, drop a hand-drawn dungeon sketch, have Mappy estimate its size, adjust if needed, position it on the hex grid, activate the relevant tiles, add wall assets to mark boundaries, bookmark the state, and link it to a session — all without leaving the builder page.
- The builder feels like drawing on graph paper, not configuring a settings panel.
- 10,000 hex tiles render and interact smoothly (no perceptible lag on scroll-zoom or paint-activation).

## Scope Boundaries

- **Not replacing the existing session map page.** The builder is a new `/dm/map-builder` page. Session maps continue to work as-is.
- **No real-time collaboration.** This is a single-DM prep tool.
- **No token/character placement.** Tokens live in the session map system, not the builder.
- **No procedural generation.** Mappy interprets dropped images; it does not generate maps from text prompts.
- **No print layout.** "Visible to printers" means active tiles are what would appear if printed, but the builder itself does not manage print formatting.
- **Prototype canvas is 50m x 50m.** Larger canvases (100m+) are a future extension pending performance research.

## Key Decisions

- **Overlay-first image workflow**: Dropped images always start as repositionable overlays. This eliminates the branching "add to existing? which direction?" dialog. Edge-snapping provides extension affordance naturally.
- **Hex tiles at 0.5m**: Fine-grained enough for room interiors and furniture-scale placement. Easy to communicate scale to players.
- **Flat-top hex**: Consistent with existing MapCanvas implementation. Feels more map-like for the overworld/dungeon use case.
- **Separate tool, shared output**: Builder doesn't touch session map code. Clean boundary — builder writes map data, session system reads it.
- **Levels are logical, not spatial**: Simpler implementation, matches how DMs actually think ("the cave level," "the tower level") rather than strict vertical stacking.
- **Mappy uses Claude Vision API**: Stays in the Anthropic ecosystem. Server-side calls via Anthropic SDK. Estimated ~$0.01-0.05 per image analysis.

## Dependencies / Assumptions

- Mappy requires a vision-capable AI model (Claude or similar) accessible from the server. Cost per image analysis call needs to be acceptable for DM prep frequency.
- The existing `maps` table schema may need extension (or a new `map_builds` table) to store builder-specific data (levels, assets, bookmarks, tile states).
- Canvas rendering at 10,000 tiles will likely require HTML5 Canvas or WebGL, not DOM elements. The existing `MapCanvas.tsx` is Canvas-based and can inform the approach.

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R5][Needs research] What rendering approach (Canvas 2D vs. WebGL) is needed for smooth interaction at 10,000+ hex tiles with zoom/pan? What are the performance cliffs?
- [Affects R1][Needs research] What backend storage strategy supports 10,000+ tile states efficiently? Per-tile rows vs. compressed JSONB blob vs. binary bitmap?
- [Affects R19, R20][Technical] How does canvas extension work at the data layer? Dynamic resize of the grid dimensions, or a virtual infinite canvas with a viewport?
- [Affects R22][Technical] What schema changes are needed to bridge builder maps into the existing session map system? New table vs. extended `maps` table?
- [Affects R12, R14][Technical] How are primitive assets rendered on the hex grid? SVG overlays on canvas, or drawn directly into the canvas context?
- [Affects R17][Needs research] What prompt/approach gives Mappy the best size estimates from varied image types (sketches, AI art, asset packs)?

## Next Steps

No blocking questions remain.

`→ /ce:plan` for structured implementation planning
