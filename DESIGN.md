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
