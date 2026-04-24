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

- **Never paste API keys in chat.** If the user provides a key in conversation, warn them immediately and recommend rotating it. Guide them to add keys via their editor or `! echo` prefix instead.
- **Tailwind v4 flex layout unreliable.** `flex flex-col sm:flex-row` may not kick in at expected breakpoints. Use inline `style={{ display: 'flex' }}` for critical side-by-side layouts.
- **Tailwind v4 classes break in Safari production.** Tailwind v4 uses `@property` CSS declarations that Safari may not process correctly. Components that work locally can be invisible in production. For any layout-critical element (navbars, primary containers), use inline `style={{}}` for flex, sticky, gap, and background — not Tailwind classes.
- **Image uploads are capped at 4MB.** Midjourney outputs (typically 2048x2048 PNG, ~6MB) will be rejected by the upload API. Resize with `magick <file> -resize 1024x1024 <file>` before uploading or committing to `public/`.
- **`autoFocus` on inputs causes page scroll.** If an input with `autoFocus` renders on page load (even inside a conditionally-shown panel that defaults open), the browser scrolls to it. Default panels to closed (`useState(false)`) when they contain autoFocus inputs.
- **`ensureSchema` is memoized.** After adding new DDL (tables/columns, ALTER TABLE), the dev server must be restarted — the schema won't re-run on refresh. Kill port 3000 and restart with `npx next dev -p 3000`.
- **Tailwind v4 breaks arbitrary sizing values.** `w-[70px]`, `h-[70px]`, and `grid-cols-[...]` don't reliably generate CSS. Use inline `style={{ width: 70, height: 70 }}` for precise sizing and `style={{ display: 'grid', gridTemplateColumns: '...' }}` for complex grids.
- **Always run `tsc --noEmit` before deploying.** Feature branches may merge code that references types/nav entries not present on main. Railway's build will fail on type errors that the dev server ignores.
- **`.next/types/validator.ts` stale errors on feature branches.** On a feature branch, `tsc --noEmit` will emit "Cannot find module '../../app/.../route.js'" errors for routes that exist on main but not this branch. Filter them out with `npx tsc --noEmit 2>&1 | grep -v ".next/types"`. They regenerate correctly on next build.
- **Deploy to Railway with `railway up`.** Auto-deploy from GitHub push may not trigger — use `railway up` explicitly to upload and build.
- **Safari ignores `scrollbar-width: none` on textareas.** Use a wrapper `overflow-hidden` div with the textarea sized wider to clip the native scrollbar off-screen.
- **Linter/formatter reverts file edits.** When editing `PlayerSheet.tsx` or other large components, changes to props/state declarations get silently reverted between edits. Commit immediately after making working changes to prevent loss.
- **Player IDs are not character names.** Player IDs (`ashton`, `brandon`, etc.) are in the `players` table; character names are display-only. Routes use IDs: `/players/ashton`, not `/players/ash`.
- **`next/image` rejects query strings on local paths.** Next.js 16 throws if an `<Image>` src has a `?t=...` cache-buster. Use plain `<img>` tags for uploaded/API-served images.
- **Scope-trimming feature units.** When a planned implementation unit turns out to be two features hiding inside one (e.g., "apply canonical scale to the builder" turned into "also render images in the builder for the first time"), trim scope and defer the larger piece with a plan note. Deliver user value in the current commit; don't pretend the scope was always smaller.
- **Client components can't transitively import `lib/db.ts`.** A `'use client'` component that imports a helper which itself imports from `lib/db.ts` will drag `pg` into the client bundle and Turbopack will fail with "Module not found: Can't resolve 'tls'". Split pure helpers (formatters, type guards) into a separate file with no DB imports — see `lib/game-clock-format.ts` next to the server-only `lib/game-clock.ts`.
- **JavaScript `%` is remainder, not modulo.** `(-1) % 2 === -1`, so `col % 2 === 1` misclassifies every negative odd column as even. For sign-safe odd tests use `((col % 2) + 2) % 2 === 1`. This bit `lib/hex-math.ts::hexCenter` and `hexNeighbors` once the world map started using negative hex coordinates (existing builder canvases never hit it because they use `col >= 0`).
- **Turbopack bundles go stale on new prop additions.** Whenever you add a new prop to a client component that's hydrated from a server component (e.g. Globe3DClient), the client bundle picks up the new prop name but the server-rendered HTML still uses the old tree. Result: runtime `undefined is not an object` or hydration mismatch on the new field. Fix: `lsof -ti :3000 | xargs kill -9 && rm -rf .next/cache && npx next dev -p 3000`. HMR alone won't fix it.
- **H3 res-4 globally is too heavy for the RSC payload.** 288,122 cells × boundary arrays ≈ 40 MB JSON. SSR takes 70+ seconds and first paint is blocked. For high-res H3 work, never call `prepareResolution(4, ...)` (or higher). Use sparse prep: `prepareCells(ids, ...)` with the handful of cells you actually need (e.g. `gridDisk(origin, k)` or `cellToChildren(parent, 4)`). Res 0/1/2/3 are fine at global scale (≤41k cells).
- **R3F onClick needs a concrete mesh under the hood.** `<group onClick={...}>` works because raycasting hits the child meshes and the event bubbles. On `<primitive>` from a loaded GLB, wrap it in a `<group>` and put the handlers there. Add `onPointerOver`/`onPointerOut` to swap `document.body.style.cursor` for affordance — drei/R3F doesn't do this automatically.
- **GLB opacity must be applied to each mesh's material.** `<primitive>` has no opacity prop — traverse `.scene` (or a clone), set `material.transparent = true` at clone time, then update `material.opacity` in a `useEffect` keyed on the opacity value. Return `null` when opacity is below ~0.001 to skip the draw call entirely.
- **Camera on the equator plane (y=0) guarantees vertical world +Y on screen.** If you place the camera anywhere off-equator and look at origin, `camera.up = (0,1,0)` still projects world +Y *close to* screen-up but not exactly — you'll see the axis canted. For any "pole-is-vertical" view, set camera position with `y = 0` explicitly; pick longitude by the lat/lng you want framed above the horizon.
- **Auto-scale GLB models by bounding box, not hard-coded scale.** `new THREE.Box3().setFromObject(clone)` + `box.getSize()` gives native dims. Compute `scale = targetSize / native` — avoids scale magic numbers that break when the model is re-exported at different units. Pattern used in `TerritoryWolfToken` for hex-sized rendering.

## Output conventions

- **Server links / URLs on their own line in backticks.** They render blue and are easy to click. Never inline a clickable URL in prose.
- **Always number questions to the user.** When asking the user any question, prefix it with `Q1.`, `Q2.`, etc. Even a single question gets `Q1.` so the user can refer back to it by number in their reply.

## Local Dev Server
When making changes that need a server restart (new DDL, cache issues, etc.), handle it directly — kill port 3000 and restart with `npx next dev -p 3000` using the Bash tool. Run the server in the background. Don't ask the user to do it.

## GITHUB
Alert the user on a local push or commit if the change has not been pushed to Github.

## AR Assets
Whenever a new `.glb` or `.usdz` file lands in `public/models/` (or an existing one is replaced), run the `ar-asset-optimizer` skill at `.claude/skills/ar-asset-optimizer/SKILL.md` before committing. It assesses, downsizes, and validates the file. Raw Fab/Blender exports are routinely 20–40 MB; the skill targets a ≤2 MB hero budget. Never commit a raw export without running this skill first.

**TODO**: build a DM-facing AR asset upload tool (`/dm/ar` or similar) that lets the DM drop a `.glb` / `.usdz` and automatically runs the optimizer pipeline server-side. Until that exists, new AR models are added by hand and the optimizer skill is invoked by Claude before the commit.

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