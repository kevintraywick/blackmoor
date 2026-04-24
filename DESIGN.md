# Design Notes

Living document for UI/UX decisions and constraints. Review before making visual changes.

## Core Principle

**Immediate understanding.** Every page should be understood at a glance. No learning curve, no hidden state, no progressive disclosure. If a user lands on a page, they should know what it is, what it shows, and what they can do — instantly.

**Never a blank canvas.** Creation flows should start with something, not nothing. When AI is available, auto-fill forms with reasonable defaults so the DM tweaks rather than writes from scratch. The starting point is a draft, not an empty form.

**Zero friction to the game.** The DM and players are at the table with a session in motion. The app exists to help them do game things — take a turn, check a stat, see a map, read a note. Every tap, scroll, dropdown, confirmation, extra link, or typed character that isn't directly in service of a game task is a delay they'll feel mid-session. Prefill when possible. Land them on the thing they came for. Don't gate content behind intro screens, "continue" buttons, or progressive reveals. If two taps accomplish what one can, use one.

**Immediate engagement.** The moment a player opens the site, something should catch their attention — weather on their banner, a pulsing notification, a newsie calling headlines, a new raven waiting. The page is never static or waiting for them to act first. The world has been moving while they were away, and the site shows it.

## Ideas

In-flight feature concepts that have been brainstormed but not yet specced or built. Each entry captures the agreed direction and known constraints. Promote to a real spec in `docs/superpowers/specs/` when ready to plan.

### The Raven Post — living-world news service

A multi-medium news service that pushes the campaign world into players' lives between sessions. The DM **curates** short beats produced by a persistent **World AI**; the system delivers them at the right time through the right channel. Brand it **The Raven Post (RP)**. Lives at `/raven-post`, with a link in the player nav between Marketplace and *The story so far…*.

**TODO: Raven Radio.** Eventual evolution — a 24/7 in-fiction radio stream layered on top of the news service. Pre-rendered news segments cross-faded with public-domain or licensed period music. Players tune in. Out of v1 scope.

**TODO (v2): External-service failure alerts.** When ElevenLabs or Twilio calls fail (budget cap hit, API key missing, upstream down), surface a heads-up banner on `/dm/campaign` so the DM learns about it immediately rather than discovering it through missing newsie audio or silent SMS. Should also catch failures logged by `lib/elevenlabs.ts` and `lib/twilio.ts`. Out of v1 scope — v1 silently degrades per `lib/email.ts` pattern.

**Mediums (in scope):**
- **Broadsheet** — the `/raven-post` page itself. Discworld-style front page, parchment + black-letter masthead, 4–6 headlines, classifieds, weather, omens. Always available, no notification required to view.
- **Raven** — short, urgent, named-sender messages. Surfaced on the RP page; not pushed via channel.
- **Sending** — cryptic, ≤25 words, DM-direct to one PC. **No replies of any kind.** Surfaced on the RP page.
- **Overheard** — location-triggered tavern rumor. When a player is within **100 m of the library** (Citadel Tree, lat `36.34289`, lng `-88.85022`), they receive an SMS with the overheard text. Reuses the AR encounter geolocation pattern. Only fires once per item per player. (TODO: cooldown rules.)
- **Town Crier (audio)** — see *Newsie call-out* below.
- **Weather layer** — current world weather is rendered both as a staple of the RP front page AND as a visual overlay on the **player banner** at the top of `/players/[id]` (rain streaks, fog, snow, storm flicker, etc.). Driven by the same world-weather state.

**Mediums explicitly out of scope (for now):**
- Email delivery (drop entirely)
- Discord delivery (drop for now; **TODO:** dedicated `#raven-post` channel + bot push)
- Session-start "what you hear on the road" recap screen (drop)

**Newsie call-out (player page audio):**
- After the player has been on `/players/[id]` for a random **10–20 seconds**, an audio clip plays of a newsie crying *"News, &lt;top headlines&gt;, News..."* with the current top headlines stitched in.
- Immediately after the audio, the **The Raven** nav link pulses bright red for **10 seconds**, then **fades over the next 30 seconds** back to normal.
- **TODO:** suppress both the audio and the pulse if the player has already read the current top headlines.

**SMS delivery:**
- SMS is the **only** push channel in v1. Front and center in the player's settings.
- Always **opt-in / opt-out** per player. Default off.
- Used for high-stakes pushes: Overheards (location-triggered), Ravens marked urgent by the DM, Sendings.

**Engine principles (carry forward into spec):**
- Hooks into the existing **game clock** (`lib/game-clock.ts`). Items publish when the DM advances time or explicitly at session end.
- Each item is tagged with entities (NPC, location, faction) so the **callback engine** can chain related items into running threads — what makes the world *feel* alive.
- Trust tiers (Official / Whispered / Rumored / Prophesied) are visible to players. The medium implies the trust.

**The World AI (the heart of the system):**
- A persistent agent that runs on a loop, reads the campaign state (journal, journey, world map, weather, army positions, current hex, player notes), and **proposes new plausible events** that extend the established fiction.
- *Examples of plausible events*: a tavern burns down (tied to a city the party is nearing), a king's decree, a ship leaving that needs sailors, a ship arriving with cargo and rumor, a comet crossing the sky, a plague rumor from the next valley over, a missing-children whisper, a faction tax, a public hanging, **guild news** (promotions, expulsions, contracts), **mentor news** (the party's mentors growing, dying, reaching out), **skill-building hooks** (a master willing to teach for a price).
- *Knows each player intimately* — the agent reads every PC's species, class, level, alignment, **backstory**, gear, spells, items, boons, poisons, and **play history** (recent sessions, marketplace activity, initiative rolls, the journal entries they featured in). Proposals for Pip the Halfling Ranger reference Pip's actual mentor by name and the actual manner of their death from the actual journal entry. The agent isn't writing for *a* party — it's writing for *this* party.
- *Authority*: agentic, full web search. Can study fantasy literature, fiction, films, and games and pull from Wikipedia/Wikia/etc. to draw genre-appropriate parallels.
- *Real-world awareness*: the World AI knows the **real-world moon phase** and lunar calendar, so a real full moon tonight can become an in-fiction full moon in the broadsheet — the wolves are restless, the wyrd-women sing, the tide pulls strange. Same for solstices, eclipses, and notable astronomical events.
- *Loop trigger*: time-based background loop **plus** an explicit DM "Generate now" button. No automatic ticks on game-clock advance — DM is in control of the cadence.
- *Persistent state*: maintains its own memory of what it's proposed, what was accepted, what was rejected (deferred — unchecked items aren't rejections, they're queue-pushdowns), and which themes are currently in play.
- *Output*: a stream of **suggested beats** that land in the DM's RP curation pane (see "DM curation window" below). The DM is always the author of record — the World AI never publishes directly to players.
- *Resourcing*: needs its own planning pass via `/ce:plan` to scope the loop, model, budget, and guardrails. Likely Anthropic Claude (Haiku-first triage, Sonnet for high-quality drafts) with web search permissions.

**DM curation window (`/dm/raven-post`):**
The DM's view of the Raven Post is a multi-pane curation surface, similar in spirit to the Player Notes box on the player sheet:

1. **World AI Suggestions** — top pane. Streamed proposals from the World AI. **No edit/publish/reject buttons.** Each proposal is a checkbox row the DM edits inline directly in the box. **Checking the box = publish.** Leaving a box unchecked **does not reject it** — it pushes that item further down the queue so the next loop can revisit, evolve, or replace it.
2. **Manual Compose** — DM-authored beats from scratch. Same fields as a published item.
3. **Library Overheard Queue** — a list of rumors waiting to fire when a player walks within 100 m of the Citadel Tree library. FIFO. No replays. The DM can add, edit, reorder, and see which players have already received which rumor.
4. **Published Items** — recently-published items, editable until they're seen by players.

**Advertising:**
- The Raven Post **carries advertising** as part of its in-fiction texture (Discworld's classifieds are the model).
- *In-world ads*: a smith on Copper Lane, a caravan recruiting guards, a fortuneteller's tent.
- *Real-world ads*: actual products that fit the fiction (dice, dice trays, leather journals, miniatures). Manual entry by the DM with image, link, and copy.
- **Real-world stays out of the broadsheet.** The ad as printed on the Raven Post is fully in-fiction — period typography, in-world prose, no pricing, no URLs. The real-world product details (price, link, vendor) only appear when the player **clicks the ad**. The fiction is never broken on the page itself.
- **TODO: bookstore + D&D specialty directory** — maintain a list of FLGS bookstores (especially those near the table) and D&D specialty sites (minis, dice, books). The World AI scans these for sales and proposes ads when something on sale fits a current beat.

**Spend tracker (`/dm/campaign`):**
- A live $-spend widget on the Campaign page, **page-width, placed at the bottom of the page** (after all existing fields and the home art drop circle).
- Tracks running monthly cost across: **ElevenLabs** (TTS), **Anthropic** (Claude — World AI loops + manual drafts), **Twilio** (SMS), **web search**, and **Railway** (hosting + DB).
- **Soft target: under $20/month** with default caps (see budget breakdown in the spec).
- **Hard kill switches** — DM can pause the World AI loop and the SMS push from the same widget.

**Campaign page cleanup (related):**
- **Remove the Background textarea** from `/dm/campaign` (`components/CampaignPageClient.tsx` line ~134, the "The campaign backstory…" field). The campaign backstory belongs in the **journal**, not on the campaign settings page. The DB column can stay; the field stops rendering.

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
- **AI accent**: `#4a8ab0` — muted aged-ink blue, warm-palette friendly. Use for any UI affordance driven by AI (the "brain" draft button, AI suggestion pills, AI-generated content indicators). Not for links, state, or non-AI chrome. Exported as `AI_BLUE` from `components/dm/raven-editor/EditableProse.tsx`.
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

## DM Comm Boxes

The DM-side communication boxes on `/dm/players` (DM Notes, DM Message, Druid Sign, Thieves' Cant, Sending) share a readability rule:

- **All readable text is white.** Section labels, status labels (when inactive), sent-message bodies, and sent-item quotes all use `text-white`. Previously these used tinted low-contrast greens/purples/reds/yellows that were hard to read against the dark themed backgrounds.
- **Dimness is expressed through `opacity`, not off-white hues.** Read-but-still-visible items use `opacity-60`. Timestamps and ancillary metadata use `opacity-50`. Disabled / "(not a rogue)" hints use `opacity-50`.
- **Placeholders stay dim themed colors** so they read as empty state, not as content.
- **Active status labels keep their semantic color** (green = active, gold = away, red = remove) — that color *is* the signal.

## Player Notifications

The right half of the player sheet header is a row of notification glyphs. Order left-to-right; each one only renders when its condition is true. Click a glyph to open its panel.

| Notification    | Glyph                              | Color / treatment                                | Trigger                          | On click                                                                  |
| --------------- | ---------------------------------- | ------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------- |
| DM Message      | ⚡ lightning bolt (SVG)            | Red `#dc2626`, rotated −15°, pulses when unread  | DM sends a message to the player | Opens message pane; marks all read                                        |
| Boon            | ⚡ lightning bolt (SVG)            | White `#ffffff` w/ glow; pulses until first seen | DM grants a boon                 | Opens boon panel; marks seen                                              |
| Poison          | 🤢                                 | Pulses while active                              | Poison applied to player         | Opens poison panel                                                        |
| Sending         | 👂                                 | Pink/magenta glow; pulses while unread           | Raven Post sending published     | **Fountain of sparkles** (`SendingSparkle.tsx`) erupts at click point; opens sendings list; marks read |
| Thieves' Cant   | 🗝️                                 | Dim, no behavior (placeholder)                   | Class includes "rogue"           | —                                                                         |
| Druid Sign      | 🌿 leaf sprig                      | Dim, no behavior (placeholder)                   | Class includes "druid"           | —                                                                         |

**Sparkle fountain (sendings):** ~40 particles (✦/✧/·) in soft purple, gold, and warm white. Fountain shape — biased upward with horizontal spread, ~2.5s lifetime. Fires at the cursor position, not the icon's bounding box, so it follows the click. Disabled until the icon is clicked (no auto-fire on page load).

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

## Roadmap (`/do`)

- **Ground truth is the database**, not `ROADMAP.md`. The `roadmap_items` table is seeded from `ROADMAP.md` on first access (if empty), but after that the DB is authoritative. Edits on prod persist across deploys.
- **`ROADMAP.md` is a generated artifact.** Call `POST /api/roadmap/sync` to regenerate `ROADMAP.md` from the current DB state. Keep it in git as a human-readable snapshot, not as the source of truth.
- **Add, remove, toggle** all write to the DB via `/api/roadmap/{add,remove,toggle}`. No filesystem writes.

## Globe (`/dm/globe-3d`)

The 3D globe is the Common World's master map. H3 hex grids at multiple resolutions crossfade by camera distance over a NASA Blue Marble texture.

### Core conventions

- **Res-0/1 outlines** fade out at close zoom (floors = 0). Res-2 and res-3 fade in as the camera approaches.
- **Res-4 is the "campaign-scale" resolution.** One res-4 hex ≈ 1,770 km² (edge ~22.6 km, vertex-to-vertex ~45 km — a small US county / day's-walk region). Every campaign is anchored to one res-4 origin hex.
- **Campaign footprint = origin + 6 adjacent hexes (7 total).** This is the starting territory for any campaign. Implemented as `campaignCells(originCell)` = `gridDisk(originCell, 1)`.
- **Eligible origin candidates** are the res-4 children of the res-2 hex containing an existing origin (49 children minus that campaign's 7). White fill, 22% opacity. New campaigns land inside this halo.
- **Shadow is the GPS-selected exception.** Its origin is the res-4 parent of Blaen Hafren (the anchor cell at the Severn headwaters in Wales). Every other campaign origin is DM-selected.
- **Never prep res-4 globally** — 288k cells is too heavy for the RSC payload (~40 MB, 70s SSR). Use sparse prep via `prepareCells(ids, ...)` with ids derived from `gridDisk`, `cellToChildren`, etc.

### Camera conventions

- **Initial position**: equator plane (y=0), longitudinally aligned with Shadow's anchor, distance 3.0. Guarantees the N-pole cone points vertically straight up on first load.
- **minDistance = 1.25, maxDistance = 5.** Below 1.25 the res-3 grid becomes too pixelated to read; above 5 the globe is uselessly small.
- **Panning enabled** (`enablePan` + `screenSpacePanning`). Right-click/two-finger drag pans.
- **Reset and Go-to-anchor buttons** explicitly reset `controls.target = (0,0,0)` after moving the camera.
- **Fly-to animation**: camera tweens with ease-out cubic over 1.2s. Triggered via `CameraController.flyToAnchor(distance)` imperative handle. Used by the wolf token's click.

### Palette

- `globe_col_A`: warm cream backdrop (`#f0e0c8`), dark slate cells (`#2b3e67`), orange Shadow highlight (`#ff7a2a` — matches N-pole cone).
- White for eligible-origin fill and campaign outlines.
- Pentagon / astral void cells: grey (`#6e7480`).
- Anchor marker (pulsing "you are here"): pink (`#ffb5c5`), radius 0.0012, fades out 1.4 → 1.0.

### Tokens

- **Campaign token** (wolf for Shadow) has two LOD variants:
  - **Planetary wolf**: small (`scale=0.000512`), visible at planetary zoom, fades out as you zoom in (1.75 → 1.25). Clickable — fires a fly-to at the anchor.
  - **Territory wolf**: auto-sized via `new THREE.Box3().setFromObject()` to fill the origin res-4 hex (~0.006 world units on the unit sphere). Fades in at close zoom (1.5 → 1.25).
- Assets live under `public/tokens/`. Must be committed or Railway 404s at runtime. Run the `ar-asset-optimizer` skill on new `.glb` uploads.

### Earth texture

- Source: NASA Blue Marble Next Gen + topo + bathy from `neo.gsfc.nasa.gov/archive/bluemarble/bmng/world_8km/`. Downloaded as 5400×2700, resized with `magick -resize 4096x2048 -quality 88`. Stored as `public/textures/earth_4096.jpg` (1.2 MB).
- Opaque with `depthWrite` on. No transparency — texture paints cleanly over cell layers below.

## Raven Post Broadsheet — Layout 1 v1

Basic design for the front page of The Raven Post, rendered by `components/RavenBroadsheet.tsx`. Evolve as "Layout 2", "Layout 1 v2", etc. — do not silently mutate v1.

**Section map:**

| #    | What it is                                            |
| ---- | ----------------------------------------------------- |
| (1)  | Masthead                                              |
| (2)  | Big Headline                                          |
| (3)  | Col 1 — lead column text                              |
| (4)  | Col 2 — hero image                                    |
| (5)  | Col 2 — image caption                                 |
| (6)  | Col 3 — top-right secondary lede                      |
| (7)  | Col 2 — middle lede (below caption)                   |
| (8)  | Col 1 — ad (linked image)                             |
| (9)  | Col 2 — Spot Prices (sparkline charts)                |
| (10) | Col 1 — Quote of the Day                              |
| (11) | Col 3 — bottom-right Opinion                          |

**Structure (top to bottom):**
1. **(1) Masthead** — Edition Stamp (circular wax stamp, top-right, `Volume N / Issue N` inside, "Published Fortnightly · Black Feather Press" curved around the rim), arrow piercing the masthead (`public/images/raven-post/arrow.png`, `left: 68%`, rotated `6deg`, behind text), title "The Raven Post" (UnifrakturMaguntia, `4.2rem`), tagline "❦ News, Gossip and Tales of the Realm ❦" flanked by hairline rules, date row ("Nth of <ShireMonth>, CY 581" — see `lib/shire-date.ts`) + "One copper".
2. **(2) Big Headline** — page-width uppercase serif (`3.4rem`), rule underneath.
3. **Three-column grid** (1fr · 1fr · 1fr, `gap: 18`, `alignItems: stretch`):

   | Column 1 (left)              | Column 2 (center)           | Column 3 (right)        |
   | ---------------------------- | --------------------------- | ----------------------- |
   | (3) Lead column text         | (4) Hero image + (5) caption | (6) Secondary lede     |
   | (8) Ad (linked image)        | (7) Middle lede             | (11) Opinion            |
   | (10) Quote of the Day        | (9) Spot Prices (Gold/Silver/Copper sparklines) |     |

   Each column is a flex-column. **QOTD (10) and Spot Prices (9) use `marginTop: auto`** to pin to their column bottom — regardless of how long Opinion (11) gets, the bottoms of QOTD and Spot Prices always align.
4. **Bottom rule** — `4px double` border echoing the masthead.

**Slotting rules:**
- Broadsheet items (`medium='broadsheet'`) are matched into fixed sections by headline regex:
  - `/crimson\s*moon/i` → section (6)
  - `/blood\s*moon/i` → section (7)
- Unmatched broadsheet items are currently unused in v1. Future layouts can introduce an overflow region.

**Ad system (section 8):**
- Tiny "Paid Advertisement" label (0.55rem, tracked, muted brown) sits above the ad image.
- Ad image: fixed `height: 180, objectFit: cover`, dimmed via `filter: brightness(0.8)` so it doesn't overpower the parchment.
- "ONLY $15!!!" price overlay — absolute-positioned white serif, 2.2rem weight 900, rotated `-15deg`, with a black text-shadow so it reads on any part of the image.
- Image is wrapped in an `<a target="_blank">` linking to the real product.
- Source of truth: `raven_ad_products` (DB table seeded in `lib/schema.ts`). v1 hardcodes the `chaos-engine-dice` row (dnddice.com); the World AI will pick tag-matched products in a later pass.
- Product images live under `public/images/ads/`.
