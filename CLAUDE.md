@AGENTS.md
@DESIGN.md
@COMMS.md

## Design Context

### Users
DM and players use this tool at the table during sessions (players on phones/tablets, DM on desktop/laptop) and between sessions for prep and reference. The DM manages sessions, maps, fog-of-war, notes, and inventory. Players check their character sheets and see live map updates. Latency and clarity matter — players glance at this mid-conversation, the DM uses it while running the game.

### Brand Personality
**Mythic · Warm · Alive**

This is a tool for heroes and the people who run their world. It should feel like sitting around a fire with a story unfolding — not like opening an app. Warmth over coldness, legend over polish, presence over perfection.

### Aesthetic Direction
**Physical artifact, not a screen.** The interface should evoke old books, worn leather, hand-drawn maps, and candlelight — not D&D Beyond's branded app polish, not a generic dark-mode SaaS dashboard.

- **DO**: Rich warm browns, amber gold, aged parchment tones, deep crimson. Textures that suggest wear and use.
- **DO**: Typography that feels crafted — EB Garamond (already in use) for body; display type should feel like a title page or carved stone, not a logo.
- **DO**: Interfaces that feel like physical objects — a session log is a field journal, a character sheet is a filled-out form, a map is a map.
- **DON'T**: Glassmorphism, neon, gradients, glowing UI elements, rounded-corner cards with drop shadows.
- **DON'T**: Polished/branded fantasy (D&D Beyond, video game HUD aesthetic).
- **DON'T**: Clean modern dark mode (slate/indigo/neutral palette, geometric sans-serif everywhere).

### Design Principles
1. **Firelight, not fluorescent** — warmth is the dominant mood. Every surface should feel like it was made near a fire, not under office lights.
2. **Worn, not broken** — the interface suggests use and history. Subtle imperfections, aged textures, and uneven weight feel intentional, not sloppy.
3. **Clarity at a glance** — players check their sheets mid-game. The DM reads session notes while talking. Information must be scannable under pressure.
4. **Physical object logic** — design as if each page is a real thing (a ledger, a scroll, a map). Typography, layout, and spacing should reinforce that mental model.
5. **Alive but not loud** — motion and interaction should feel organic (a page turning, ink settling) not performative (bounces, pulses, glow effects).

### UI Preferences
- **No hidden-choice controls without asking first.** Before implementing a `<select>` dropdown, `<datalist>`, or any pull-down menu, ask the user — they prefer options to be visible on the page (radio buttons, button groups, segmented controls, etc.). Only use a dropdown if the user explicitly approves it after seeing the alternatives.
- **No scrollable containers by default.** Do not use `overflow-y-auto`, `max-h-*`, or any scroll-constrained container unless the user specifically requests it. Show all content at full height. Only suggest a scrollable container if it is clearly the superior solution, and get approval first.

### Page-Specific Aesthetics
- **Journey Map** is an exception to the warm/dark aesthetic — it should feel **cheerful and light**. Saturated soft blues, white circles, light text. Unlike the rest of Shadow of the Wolf.

## Gotchas

- **Image uploads are capped at 4MB.** Midjourney outputs (typically 2048x2048 PNG, ~6MB) will be rejected by the upload API. Resize with `magick <file> -resize 1024x1024 <file>` before uploading or committing to `public/`.
- **`autoFocus` on inputs causes page scroll.** If an input with `autoFocus` renders on page load (even inside a conditionally-shown panel that defaults open), the browser scrolls to it. Default panels to closed (`useState(false)`) when they contain autoFocus inputs.
- **`ensureSchema` is memoized.** After adding new DDL (tables/columns), the dev server must be restarted — the schema won't re-run on refresh.
- **Tailwind v4 breaks `grid-cols-[...]` arbitrary values.** Use inline `style={{ display: 'grid', gridTemplateColumns: '...' }}` instead for complex grid templates.
- **Safari ignores `scrollbar-width: none` on textareas.** Use a wrapper `overflow-hidden` div with the textarea sized wider to clip the native scrollbar off-screen.
- **Linter/formatter reverts file edits.** When editing `PlayerSheet.tsx` or other large components, changes to props/state declarations get silently reverted between edits. Commit immediately after making working changes to prevent loss.
- **Player IDs are not character names.** Player IDs (`ashton`, `brandon`, etc.) are in the `players` table; character names are display-only. Routes use IDs: `/players/ashton`, not `/players/ash`.

## GITHUB
Alert the user on a local push or commit if the change has not been pushed to Github.
