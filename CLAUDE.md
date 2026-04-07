@AGENTS.md
@DESIGN.md

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

## Gotchas

- **Image uploads are capped at 4MB.** Midjourney outputs (typically 2048x2048 PNG, ~6MB) will be rejected by the upload API. Resize with `magick <file> -resize 1024x1024 <file>` before uploading or committing to `public/`.
- **`ensureSchema` is memoized.** After adding new DDL (tables/columns, ALTER TABLE), the dev server must be restarted — the schema won't re-run on refresh. Kill port 3000 and restart with `npx next dev -p 3000`.
- **`.next/types/validator.ts` stale errors on feature branches.** On a feature branch, `tsc --noEmit` will emit "Cannot find module '../../app/.../route.js'" errors for routes that exist on main but not this branch. Filter them out with `npx tsc --noEmit 2>&1 | grep -v ".next/types"`. They regenerate correctly on next build.
- **Scope-trimming feature units.** When a planned implementation unit turns out to be two features hiding inside one (e.g., "apply canonical scale to the builder" turned into "also render images in the builder for the first time"), trim scope and defer the larger piece with a plan note. Deliver user value in the current commit; don't pretend the scope was always smaller.

## Output conventions

- **Server links / URLs on their own line in backticks.** They render blue and are easy to click. Never inline a clickable URL in prose.

## GITHUB
Alert the user on a local push or commit if the change has not been pushed to Github.

## Code Quality Rules

- Always use TypeScript (.ts/.tsx) with proper type annotations on functions, variables, and props.
- Never skip type checks — no `any`, `as unknown as`, `// @ts-ignore`, `// @ts-expect-error`, or non-null assertions (`!`) to silence errors. Fix the underlying type problem.
- Run linting (`npm run lint`) before marking any feature complete, and fix all reported errors.
- Run the production build (`npm run build`) before marking any feature complete — dev mode is more forgiving than production.
- Never commit `node_modules`, build artifacts, or local database files.

## External API Rules

- Never hardcode API keys or secrets — always load them from environment variables (`process.env.*`).
- Add `.env` and `.env.*` to `.gitignore` before committing anything.
- Never call external APIs directly from the browser — always proxy through a server route so keys stay server-side.
- Always handle API errors explicitly with try/catch and user-visible error states. No silent failures.
- Validate and sanitize all data coming from external APIs (e.g. with Zod) before using it.
- Never log full API responses, request bodies, tokens, or PII in production.
- Set explicit timeouts on all external API calls (e.g. via `AbortController`).
- Respect rate limits — implement retries with exponential backoff for 429 responses.
- Pin external API versions explicitly (e.g. Stripe `2024-06-20`) rather than relying on the provider default.