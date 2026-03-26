@AGENTS.md

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

## Gotchas

- **Image uploads are capped at 4MB.** Midjourney outputs (typically 2048x2048 PNG, ~6MB) will be rejected by the upload API. Resize with `magick <file> -resize 1024x1024 <file>` before uploading or committing to `public/`.

## GITHUB
Alert the user on a local push or commit if the change has not been pushed to Github.
