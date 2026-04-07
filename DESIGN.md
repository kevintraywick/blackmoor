# Design Notes

Living document for UI/UX decisions and constraints. Review before making visual changes.

## Core Principle

**Immediate understanding.** Every page should be understood at a glance. No learning curve, no hidden state, no progressive disclosure. If a user lands on a page, they should know what it is, what it shows, and what they can do — instantly.

## Layout

- **Player sheets**: `max-w-[860px]` — this is the design minimum for content pages.
- **All other pages** (DM pages, catalogs, forms): `max-w-[1000px]` — the default desktop content width.
- All page containers use `mx-auto` centering.

## Controls

- **No dropdowns, collapsing sections, pull-downs, accordions, or hidden menus.** All options and content must be visible on the page at all times. Use radio buttons, button groups, segmented controls, or inline lists instead.
- **No scrollable sub-containers.** The page itself scrolls; interior elements do not get `overflow-y-auto` or `max-h-*` unless explicitly approved.

## Color

- **App palette**: Warm browns (`#1a1614` base) with gold accent (`#c9a84c`).
- **DM context**: Forest green (`#4a7a5a` bg, white text) for the DM nav bar and DM-only UI surfaces.
- **Magic categories**: Gold (spell), brown (scroll), purple (magic item), green (other).

## Typography

- **Serif** (EB Garamond): Body text, titles, form inputs, nav links.
- **Sans** (Geist): Section labels, small-caps headers, UI chrome.
- **Section headers**: `text-[0.7rem] uppercase tracking-[0.15em]` in gold.

## Map Builder (`/dm/map-builder`)

### Primary purpose
The Map Builder is a **map editor**, not a from-scratch map creator. Its design goal is to let the DM upload an existing map image and modify it in two ways:

1. **Add assets to an overlay layer** — props, tokens, markers, and other placed elements live above the uploaded image without altering the original pixels.
2. **Extend the map edges** — grow the canvas beyond the uploaded image's bounds (e.g. add a new room, push the world out one hex further). Out of scope for now: anything else (no in-place pixel editing, no tile painting, no procedural generation).

The blank-map flow still exists but is a secondary entry point — the feature is optimized for "I have a map, let me edit it."

### Map workflow

**World map vs local map — the core hierarchy.**

- A **world map** is a singleton. It always exists; the default is an empty hex grid with an established N. It may be incomplete and grow over time as the DM reveals hexes. There is only ever one world map.
- A **local map** is any map that isn't the world map. Each local map is anchored to exactly one world hex (its world location). Sub-locations (dungeon rooms, building interiors) attach to a *parent local map*, not directly to a hex. Multi-hex local maps are deferred.

**Adding a map.** When the user adds a map, they must first decide:
- **World addition** → edits apply to the singleton world map (extend the world's hexes, add world assets, etc.).
- **Local map** → a new local map is created and represented as a **hex tile**. The user drags the hex tile onto the world map to set its world location. The drop target hex becomes the local map's anchor.

**World map state & game time.**
The world map maintains live state driven by a DM-controlled **game clock**:
- **Game clock** — advanced by the DM via explicit "advance N hours / N days" actions on the world map. Tied into the Session Control Bar so the clock pauses when the session pauses. No auto-tick — in-fiction time and wall time diverge constantly (long rests, travel montages).
- **Weather** — stored as state per region (`clear`, `storm`, etc.). Passing storms move along stored waypoint paths; each clock advance steps them one tick.
- **Day/night** — derived from the game clock.
- **Horde / caravan / army / other-party movement** — manually placed, with optional stored waypoint paths. Each clock advance steps them one tick along their path. No AI movement in v1.

**Hex reveal state.** Every world hex is in one of three states:
- `unrevealed` — parchment blank, no terrain shown.
- `revealed` — terrain visible, no local map attached.
- `mapped` — has a local map attached; clickable to open the local map.

**Local map responsibilities.**
- **Session report integration** — the local map publishes events (party entered, NPC interaction, asset triggered). The session report subscribes. Event-based, not poll-based — the DM never types the same thing twice.
- **Local NPC movement** — manually placed NPCs with optional waypoint patrols. Advancement ticks are driven by the same DM game clock that advances world state. No AI movement in v1.
- **Environmental inheritance** — the local map reads current environmental state (weather, day/night) from its parent world hex at game time. Rendered as a top-bar pill or corner badge on the local map, not as pixel overlays on the image. A world-map storm that rolls into the hex automatically shows on the local map.

**Mappy responsibilities.**
- **N direction detection** — on any uploaded map, attempt to detect a marked N symbol (assume a consistent N symbol convention for local maps). On failure or low confidence, default to "up = N" and expose a manual rotation control. Never block grid confirmation on N detection.
- **Dimensions / scale sanity check** — flag discrepancies between AI-inferred scale and the user-confirmed grid + scale. Does not override user confirmation.
- **TODO (future)** — real-time camera feed of the physical table to detect placement of player minis on the live map.

### Home layout
- **Row 1 — three creation cards**, left to right:
  1. `[+ New Map]` — opens OS file picker (hidden `<input type="file">` triggered by ref).
  2. `(+ Drop Map)` — 200 px circular drag-and-drop zone. Dashed border by default; green border (`#4a7a5a`) + `scale(1.05)` on drag-over.
  3. `[+ Blank Map]` — inline name dialog → empty hex grid (current behavior).
  All three land on the builder editor after creation.
- **Row 2 — "Unassigned"**: builds with `session_id = null`. Section header in muted gold-uppercase.
- **Rows 3+ — per-session groups**: one group per linked session, ordered ascending by `session_number`. Group headers `Session {n} — {title}`. Cards labeled `S{n} — {name}`. Within a group, builds sort by `updated_at DESC`.

### Grid Confirmation Panel
Appears as a centered modal overlay after a fresh image upload, pre-filled with Mappy's AI analysis. Uses segmented buttons for every choice (no dropdowns):
- **Grid Type**: Square / Hex / None
- **Hex Orientation** (only when Hex): Flat-Top / Pointy-Top
- **Scale**: Combat (5 ft) / Overland (6 mi for hex, 1 mi for square)
- **Map Kind**: Interior / Exterior / Dungeon / Town / Overland / Other
- **Cell Size (image px)**: +/- stepper (existing `w-[22px] h-5` bordered button style)
- **Confidence**: high (green `#7ac28a`), medium (gold), low (pink `#c07a8a`)
- Actions: `Skip` / `Apply`. A "Calibrate manually →" link opens the two-point calibration tool in a right-side column.

## Canonical Map Scale

All map views (map builder viewer, DM session map) render at a **single site-wide pixel-per-foot ratio** so two maps of different real-world sizes appear proportional next to each other.

- **Constant**: `PX_PER_FT = 12` (defined in `lib/map-scale.ts`).
- **A 5 ft combat cell = 60 screen px** everywhere.
- Helpers: `cellScreenPx(ft)` and `imageDisplaySize({ imageNaturalWidth, imageNaturalHeight, cellSizePx, scaleValueFt })`.
- **D&D scale conventions** applied automatically:
  - Square grid → Combat → **5 ft / square**
  - Hex grid → Overland → **6 miles / hex** (classic hexcrawl; DMG wilderness travel)
  - Overrides allowed: Square Overland = 1 mile, Hex Combat = 5 ft.
- Viewers cap canvas at **1400 × 1000** with aspect preserved and wrap in a scrollable container. Maps without scale metadata (legacy rows where `cell_size_px` or `scale_value_ft` is null) fall back to the prior fit-to-container behavior — no regression.
