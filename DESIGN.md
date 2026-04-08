# Design Notes

Living document for UI/UX decisions and constraints. Review before making visual changes.

## Core Principle

**Immediate understanding.** Every page should be understood at a glance. No learning curve, no hidden state, no progressive disclosure. If a user lands on a page, they should know what it is, what it shows, and what they can do — instantly.

**Never a blank canvas.** Creation flows should start with something, not nothing. When AI is available, auto-fill forms with reasonable defaults so the DM tweaks rather than writes from scratch. The starting point is a draft, not an empty form.

**Zero friction to the game.** The DM and players are at the table with a session in motion. The app exists to help them do game things — take a turn, check a stat, see a map, read a note. Every tap, scroll, dropdown, confirmation, extra link, or typed character that isn't directly in service of a game task is a delay they'll feel mid-session. Prefill when possible. Land them on the thing they came for. Don't gate content behind intro screens, "continue" buttons, or progressive reveals. If two taps accomplish what one can, use one.

## Rotating Images

**Drop a file in the folder, and it joins the rotation.** Any component that rotates through a set of images (banners, backdrops, splash art) must discover its image list at runtime by scanning the folder — never hardcode counts or filenames in the component. Adding a new image should require zero code changes.

- **Source of truth**: files in `public/images/<topic>/`, named with a common prefix (e.g. `player_banner_1.png`, `player_banner_2.png`, …).
- **Listing API**: `GET /api/banners/[folder]` returns `{ images: string[] }` sorted numerically by suffix. New rotating surfaces register a folder in the `BANNER_FOLDERS` allowlist in `app/api/banners/[folder]/route.ts` — allowlisted folders only, no arbitrary path scanning.
- **Client pattern**: fetch once on mount, store URLs in state, rotate via index. Fall back silently (render nothing) if the fetch fails or the list is empty. See `components/PlayerBanner.tsx` for the reference implementation.
- **Ordering**: images sort by the numeric suffix after the prefix (`_1, _2, _3, …`), so renaming or gaps (`_1, _3, _7`) still sort correctly.

## Layout

- **Player sheets**: `max-w-[860px]` — this is the design minimum for content pages.
- **All other pages** (DM pages, catalogs, forms): `max-w-[1000px]` — the default desktop content width.
- All page containers use `mx-auto` centering.

## Controls

- **No dropdowns, collapsing sections, pull-downs, accordions, or hidden menus.** All options and content must be visible on the page at all times. Use radio buttons, button groups, segmented controls, or inline lists instead.
- **No scrollable sub-containers.** The page itself scrolls; interior elements do not get `overflow-y-auto` or `max-h-*` unless explicitly approved.
- **No visible scrollbars.** Scrollbars are hidden globally via CSS (`scrollbar-width: none`). Users navigate by scroll wheel, trackpad, or finger. Do not re-enable scrollbars without explicit approval.
- **+/− buttons for numeric adjustments.** Use the small `w-[22px] h-5` bordered buttons from `PlayerSheet` Stat component for any numeric stepper (HP, gold, timers, etc.). Style: `bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm` with gold hover. Value displayed between the buttons.
- **Radio-style selectors** use unfilled circles (`border: 2px solid #5a4f46`) that fill green (`#4a7a5a` with ✓) when selected.

## Responsive / Mobile

- **Mobile-first with Tailwind breakpoints.** Default styles target mobile; `sm:` (640px+) targets desktop. One component, not separate pages.
- **Touch targets**: Minimum `py-3` padding on tappable rows, portraits at `w-10 h-10`, checkmarks at `w-5 h-5` on mobile. +/- buttons expand to `w-8 h-8` on mobile (32px touch targets).
- **Stacking**: Multi-column grids collapse to single column on mobile (`grid-cols-1 sm:grid-cols-3`).
- **Player selector circles**: `w-14 h-14` on mobile, `w-20 h-20` on desktop. On DM Players page, circles accept drag-and-drop image upload (green border + scale on hover). Uploaded images stored in `/data/uploads/players/`, served via `/api/uploads/players/[filename]`.
- **Stats row**: Two rows on mobile (HP/AC/Level/Gold + XP/Speed/Size), single row on desktop.
- **Header**: Stacked on mobile (name row + fields row, Discord hidden), single inline row on desktop.

## Color

- **App palette**: Warm browns (`#1a1614` base) with gold accent (`#c9a84c`).
- **DM context**: Forest green (`#4a7a5a` bg, white text) for the DM nav bar and DM-only UI surfaces.
- **Magic categories**: Gold (spell), brown (scroll), purple (magic item), green (other).
- **Poison context**: Green (`#4a7a5a` for active indicators, `#7ac28a` for text). Nav tab pulses green when active.
- **DM message dot**: Bright red `#dc2626` dot, no label. DM sees sent message history in the red pane with read/unread indicators (red dot = unread `#dc2626`, dimmed dot = read `#3a2e2e`).
- **Boon dot**: White `#ffffff` with subtle glow (`boxShadow: 0 0 6px rgba(255,255,255,0.5)`). Pulses until player opens it, then stays solid until expired/cancelled.
- **Indicator layout**: All three indicators (boon, poison, DM) in a flex container at `right: 16` in the header. Order left-to-right: boon (white) | poison (🤢) | DM (red). Dots only, no text labels.
- **Combat panes** (Weapons, Cantrips/Spells): Warmer background `#282220` to visually elevate above other panes.
- **Journey Map**: Exception — cheerful saturated soft blues, white circles (`rgba(255,255,255,0.9)`), light path.
- **CYP availability dots**: Red (`#8b1a1a`) and green (`#2d8a4e`) dots per player row, `3.5×3.5` on mobile / `3×3` on desktop. Active dot gets `boxShadow: 0 0 6px` glow. Both empty = unseen (player dimmed). Row tap cycles: unseen → in (green) → out (red) → in...
- **CYP date circles**: 77px with inline sizing (`style={{ width: 77, height: 77 }}`), not Tailwind arbitrary values. Gold border `rgba(201,168,76,0.3)`.
- **CYP sound effects**: `swords.mp3` on "in", `run_away.mp3` on "out", `maybe.mp3` on "maybe". Volume 0.5, `.catch(() => {})` for autoplay restrictions.
- **Home button**: Use `dice_home.png` (30px circle, `rounded-full overflow-hidden`) for all links home. No text, no arrow. Tooltip: "Shadow of the Wolf". On CYP page, 77px centered at bottom.

## Typography

- **Serif** (EB Garamond): Body text, titles, form inputs, nav links.
- **Sans** (Geist): Section labels, small-caps headers, UI chrome.
- **Section headers**: `text-[0.7rem] uppercase tracking-[0.15em]` in gold. Combat pane headers slightly larger (`0.78rem`).
- **Pane body text**: `text-[1.05rem]` — unified across all player sheet panes.
- **Stat values**: `text-[1.1rem]` in the stats row.

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
- **Game clock** — campaign-wide singleton stored on the `campaign` row (`game_time_seconds`, `clock_paused`, `clock_last_advanced_at`). The only writer is `lib/game-clock.ts` (`advanceGameTime`, `pauseClock`, `resumeClock`); routes go through it. Advanced by the DM via explicit "advance N hours / N days" actions on the world map. The existing Session Control Bar's PAUSE / END SESSION? / RESUME buttons pause and resume the campaign clock alongside the session — wired into `app/api/sessions/[id]/route.ts` so the bar UI doesn't need to know about the clock. No auto-tick — in-fiction time and wall time diverge constantly (long rests, travel montages).
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

## Session Control Bar

- **5 circles** between session boxes and content pane: START, LONG REST, ROLL INIT, BOON, PAUSE. 64px, transparent bg, `1px solid rgba(201,168,76,0.4)`, white text `0.55rem` uppercase sans.
- **State machine**: START → green pulse when running → PAUSE → RESUME / END SESSION? → ENDED (red pulse). After resume, START shows green ✓ (`text-xl text-[#5ab87a]`).
- **Long Rest UI**: Three phases — confirm ("Long Rest?" with Grant Rest / Not Yet circles), resting (pulsing "Resting..."), summary ("Rested" with staggered result lines). Replaces control circles during flow.
- **Long Rest confirm buttons**: Grant Rest = 64px circle, green bg `#2d5a3f`, white border. Not Yet = 64px circle, black bg `#1a1614`, white border.
- **Combat count badge**: Removed.
- **Return to Session**: "← Session" link (`0.65rem` uppercase muted sans) top-right on Initiative and Boons pages, links to `/dm`.
- **Roll Initiative**: Links to `/dm/initiative?fresh=1` — clears saved combat state so setup view shows.

## Inline Add Pattern

All list panes (Weapons, Gear, Cantrips, Magic Items) use an inline `[+] Add item...` row:
- Sits at the bottom of the list within the same grid/layout
- `+` in a bordered box (`border border-[#3d3530] rounded w-5 h-5`), gold on hover
- Italic placeholder text in `text-[var(--color-text-dim)]`
- Click opens an inline input; Enter confirms, Escape cancels
- No separate "Add" button or section divider

## Inventory Card Builder

- **Layout**: Side-by-side — card builder (left, 480px max), card preview (right, flexible). Inline `style={{ display: 'flex' }}` not Tailwind flex classes.
- **Card types**: Magic Item (purple `#7b2d8e`), Scroll (brown `#6b4f0e`), Spell (gold `#a88a3a`). Type selector buttons at top.
- **Card preview**: `card_bg.png` parchment background, 340×480. Item image circle, title, type badge, stats, description overlaid. Read-only.
- **Risk %**: Red label (`#b91c1c`). Scrolls/spells only. In the 2-column stat grid alongside Price for spells, own row for scrolls.
- **Spell stat grid**: 2-column — Cast Time / Range / Components / Duration / Risk % / Price. No individual stat labels that are self-explanatory (e.g., "School" label removed from school buttons).
- **Title + Level**: Same row for scrolls/spells. Title left-aligned, Lvl right-aligned (50px).
- **Description**: 6-row textarea.
- **Publish button**: Below builder, full width, gold bg `#c9a84c`, serif font.
- **Image Prompt box**: Below card preview, stretches to align bottom with Publish. Auto-generates MJ prompt from description. 📋 copy button (green `#4a7a5a` border) bottom-right outside the box.
- **AI auto-fill**: Debounced 800ms on title+type change. Fills only empty fields. Silent no-op without API key.

## DM Sessions Layout

- **Row 1**: Scene | Notes — side by side, labels as inline placeholder text (no separate headers).
- **Row 2**: NPCs in this Session | Add NPCs — equal height (`items-stretch`).
- **Row 3**: Journal — Private | Journal — Public — side by side. Private is DM-only, Public is what players see on the Journey page.

## Journey Page

- **Session images**: Two per session — circle (`s{n}_circle.*`) and background (`s{n}_bg.*`). Stored in `DATA_DIR/uploads/journey/`, served via `/api/uploads/journey/[filename]`.
- **Drag-and-drop**: DM can drop images onto circles or background boxes. Green border on drag-over. Uploaded images replace previous.
- **Fallback**: No image = session number/title in circle, blue-tinted box for background.
- **Image format**: Use `<img>` tags (not `next/image`) for uploaded journey images — Next.js 16 rejects query strings on local image paths.

## Initiative Page

- **Session boxes**: Positioned at top of banner image (`marginTop: -241`), overlaying the artwork.
- **Dice button**: 60px circle with 🎲 emoji, centered between session boxes and roll pane, `marginTop: -25` to tighten spacing.
- **Roll pane**: Below dice, contains player rows and NPC rows with initiative counters.

## Player Nav Bar

- **Links**: Home (dice icon) | Player / Character | All Players | Marketplace | *The story so far…* (italic, links to Journey).
- **All links** use `text-[var(--color-text)]` for consistent brightness, `hover:text-[var(--color-gold)]`.
